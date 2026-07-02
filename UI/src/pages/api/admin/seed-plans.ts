import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

/**
 * One-shot admin endpoint to seed the Plan table.
 * Uses raw SQL per-plan to be resilient to schema drift between local and prod.
 * DELETE after use — do not leave in production.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  const ownerEmail = process.env.OWNER_EMAIL || 'preludeofme@gmail.com'

  if (!session?.user?.email || session.user.email !== ownerEmail) {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    // Step 1: Introspect the Plan table columns on production DB
    const columns = await prisma.$queryRawUnsafe<{column_name: string; data_type: string; is_nullable: string}[]>(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'Plan'
       ORDER BY ordinal_position`
    )
    const colNames = columns.map(c => c.column_name)
    logger.info(`[seed-plans] Plan table columns: ${colNames.join(', ')}`)

    // Available PlanType enum values
    let planTypeValues: string[] = []
    try {
      const rawEnum = await prisma.$queryRawUnsafe<{enumlabel: string}[]>(
        `SELECT e.enumlabel FROM pg_enum e
         JOIN pg_type t ON e.enumtypid = t.oid
         WHERE t.typname = 'PlanType'`
      )
      planTypeValues = rawEnum.map(r => r.enumlabel)
    } catch (_e) {
      // enum might not exist
    }
    logger.info(`[seed-plans] PlanType values: ${planTypeValues.join(', ') || '(none found)'}`)

    // Step 2: Create a simple insert/upsert per plan using raw SQL
    const plans = [
      { name: 'Free Local', planType: 'FREE', monthly: 0, yearly: 0 },
      { name: 'Connected', planType: 'CONNECTED', monthly: 999, yearly: 9990 },
      { name: 'Cloud Access — Starter', planType: 'HYBRID', monthly: 1999, yearly: 19990 },
      { name: 'Cloud Access — Legacy', planType: 'CLOUD', monthly: 3999, yearly: 39990 },
    ]

    // Determine which PlanType to use based on the DB enum
    let planTypeForInsert: Record<string, string> = {}
    for (const p of plans) {
      if (planTypeValues.includes(p.planType)) {
        planTypeForInsert[p.name] = p.planType
      } else if (planTypeValues.includes(p.name.toUpperCase())) {
        planTypeForInsert[p.name] = p.name.toUpperCase()
      } else {
        // Fallback: use the first available enum value or 'FREE'
        planTypeForInsert[p.name] = planTypeValues.includes('FREE') ? 'FREE' : (planTypeValues[0] || 'FREE')
      }
    }

    const results: {name: string; planType: string; ok: boolean}[] = []

    for (const plan of plans) {
      try {
        // Check if plan already exists
        const existing = await prisma.$queryRawUnsafe<{id: string; name: string}[]>(
          `SELECT id, name FROM "Plan" WHERE name = $1 LIMIT 1`,
          plan.name
        )

        if (existing.length > 0) {
          results.push({ name: plan.name, planType: plan.planType, ok: true })
          logger.info(`[seed-plans] Plan "${plan.name}" already exists (id=${existing[0].id})`)
          continue
        }

        // Insert new plan with only essential columns (schema-safe)
        await prisma.$executeRawUnsafe(
          `INSERT INTO "Plan" (id, name, "planType", "priceMonthlyCents", "priceYearlyCents", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2::"PlanType", $3, $4, NOW(), NOW())`,
          plan.name,
          planTypeForInsert[plan.name],
          plan.monthly,
          plan.yearly
        )

        results.push({ name: plan.name, planType: plan.planType, ok: true })
        logger.info(`[seed-plans] Created plan: "${plan.name}"`)
      } catch (planErr) {
        const msg = planErr instanceof Error ? planErr.message : String(planErr)
        results.push({ name: plan.name, planType: plan.planType, ok: false, error: msg })
        logger.error(`[seed-plans] Failed for "${plan.name}": ${msg}`)
      }
    }

    // Step 3: Backfill subscriptions for familyspaces without one
    let backfilled: {id: string; name: string}[] = []

    try {
      const freePlan = await prisma.$queryRawUnsafe<{id: string}[]>(
        `SELECT id FROM "Plan" WHERE name = 'Free Local' LIMIT 1`
      )

      if (freePlan.length > 0) {
        const spacesWithoutSub = await prisma.$queryRawUnsafe<{id: string; name: string}[]>(
          `SELECT f.id, f.name FROM "Familyspace" f
           LEFT JOIN "Subscription" s ON s."familyspaceId" = f.id
           WHERE s.id IS NULL`
        )

        for (const space of spacesWithoutSub) {
          try {
            await prisma.$executeRawUnsafe(
              `INSERT INTO "Subscription" (id, "familyspaceId", "planId", "billingStatus", "createdAt", "updatedAt")
               VALUES (gen_random_uuid(), $1, $2, 'ACTIVE', NOW(), NOW())`,
              space.id,
              freePlan[0].id
            )
            backfilled.push(space)
            logger.info(`[seed-plans] Created subscription for: ${space.name}`)
          } catch (subErr) {
            logger.error(`[seed-plans] Sub backfill failed for ${space.name}: ${
              subErr instanceof Error ? subErr.message : String(subErr)
            }`)
          }
        }
      }
    } catch (backfillErr) {
      logger.error(`[seed-plans] Backfill query failed: ${
        backfillErr instanceof Error ? backfillErr.message : String(backfillErr)
      }`)
    }

    return res.status(200).json({
      success: true,
      data: {
        columns: colNames,
        planTypeValues,
        planTypeForInsert,
        plans: results,
        backfilledFamilyspaces: backfilled,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : ''
    logger.error(`[seed-plans] Fatal: ${msg} ${stack}`)
    return res.status(500).json({ success: false, error: msg })
  }
}
