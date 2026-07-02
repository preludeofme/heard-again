import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

/**
 * One-shot admin endpoint to seed the Plan table.
 * Only callable by the site owner (preludeofme@gmail.com).
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
    const { PlanType } = await import('@prisma/client')

    // Step 1: Check current state
    const existingCount = await prisma.plan.count()
    logger.info(`[seed-plans] Existing plan count: ${existingCount}`)

    // Step 2: Get available enum values from the DB introspection
    const rawEnum = await prisma.$queryRawUnsafe<{enumlabel: string}[]>(
      `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'PlanType'`
    )
    const planTypeValues = rawEnum.map(r => r.enumlabel)
    logger.info(`[seed-plans] Available PlanType values: ${planTypeValues.join(', ')}`)

    // Try to list any existing plans first so we can debug
    const existingPlans = await prisma.plan.findMany({ select: { name: true, planType: true } })
    logger.info(`[seed-plans] Existing plans: ${JSON.stringify(existingPlans)}`)

    // Step 3: Build plans using raw ENUM values (avoids Prisma enum mismatch)
    const plans = [
      {
        name: 'Free Local',
        planType: 'FREE' as any,
        priceMonthlyCents: 0,
        priceYearlyCents: 0,
        tunnelEnabled: false,
        cloudGpuEnabled: false,
        cloudStorageEnabled: false,
        generationMinutesIncluded: 0,
        storageQuotaBytes: BigInt(0),
        memberQuota: 1,
        voiceProfileQuota: 2,
        prioritySupport: false,
        advancedAnalytics: false,
        isActive: true,
      },
      {
        name: 'Connected',
        planType: 'CONNECTED' as any,
        priceMonthlyCents: 999,
        priceYearlyCents: 9990,
        tunnelEnabled: true,
        cloudGpuEnabled: false,
        cloudStorageEnabled: false,
        generationMinutesIncluded: 20,
        storageQuotaBytes: BigInt(0),
        memberQuota: 10,
        voiceProfileQuota: 10,
        prioritySupport: false,
        advancedAnalytics: false,
        isActive: true,
      },
      {
        name: 'Cloud Access — Starter',
        planType: 'HYBRID' as any,
        priceMonthlyCents: 1999,
        priceYearlyCents: 19990,
        tunnelEnabled: true,
        cloudGpuEnabled: true,
        cloudStorageEnabled: false,
        generationMinutesIncluded: 60,
        storageQuotaBytes: BigInt(0),
        memberQuota: 10,
        voiceProfileQuota: 20,
        prioritySupport: true,
        advancedAnalytics: false,
        isActive: true,
      },
      {
        name: 'Cloud Access — Legacy',
        planType: 'CLOUD' as any,
        priceMonthlyCents: 3999,
        priceYearlyCents: 39990,
        tunnelEnabled: false,
        cloudGpuEnabled: true,
        cloudStorageEnabled: true,
        generationMinutesIncluded: 120,
        storageQuotaBytes: BigInt(10 * 1024 * 1024 * 1024),
        memberQuota: 20,
        voiceProfileQuota: 50,
        prioritySupport: true,
        advancedAnalytics: true,
        isActive: true,
      },
    ]

    const results: { name: string; planType: string }[] = []
    for (const plan of plans) {
      try {
        const created = await prisma.plan.upsert({
          where: { name: plan.name },
          update: { isActive: true },
          create: plan,
        })
        results.push({ name: created.name, planType: created.planType })
        logger.info(`[seed-plans] Created/updated plan: ${created.name}`)
      } catch (planErr) {
        logger.error(`[seed-plans] Failed to upsert plan ${plan.name}:`, planErr)
      }
    }

    // Step 4: Backfill subscriptions for familyspaces without one
    const freePlan = await prisma.plan.findFirst({ where: { planType: 'FREE' as any } })
    let backfilled: { id: string; name: string }[] = []

    if (freePlan) {
      const spacesWithoutSub = await prisma.familyspace.findMany({
        where: {
          subscription: { is: null },
        },
        select: { id: true, name: true },
      })

      for (const space of spacesWithoutSub) {
        try {
          await prisma.subscription.create({
            data: {
              familyspaceId: space.id,
              planId: freePlan.id,
              billingStatus: 'ACTIVE',
            },
          })
          backfilled.push(space)
          logger.info(`[seed-plans] Backfilled subscription for: ${space.name}`)
        } catch (subErr) {
          logger.error(`[seed-plans] Failed to create subscription for ${space.name}:`, subErr)
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        plans: results,
        existingCount,
        planTypeValues,
        existingPlans,
        backfilledFamilyspaces: backfilled,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : ''
    logger.error('[seed-plans] Fatal error:', { message: msg, stack })
    return res.status(500).json({ success: false, error: msg, stack })
  }
}
