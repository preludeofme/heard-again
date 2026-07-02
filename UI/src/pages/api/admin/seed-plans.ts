import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { PlanType } from '@prisma/client'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

/**
 * One-shot admin endpoint to seed the Plan table.
 * Only callable by the site owner (preludeofme@gmail.com).
 * DELETE after use — do not leave in production.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Hard guard: only the site owner can seed plans
  const session = await getServerSession(req, res, authOptions)
  const ownerEmail = process.env.OWNER_EMAIL || 'preludeofme@gmail.com'

  if (!session?.user?.email || session.user.email !== ownerEmail) {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const plans = [
      {
        name: 'Free Local',
        planType: PlanType.FREE,
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
      },
      {
        name: 'Connected',
        planType: PlanType.CONNECTED,
        priceMonthlyCents: 999,  // $9.99 — matches production pricing card
        priceYearlyCents: 9990,  // $99.90 (~$8.33/mo)
        tunnelEnabled: true,
        cloudGpuEnabled: false,
        cloudStorageEnabled: false,
        generationMinutesIncluded: 20,
        storageQuotaBytes: BigInt(0),
        memberQuota: 10,
        voiceProfileQuota: 10,
        prioritySupport: false,
        advancedAnalytics: false,
      },
      {
        name: 'Cloud Access — Starter',
        planType: PlanType.HYBRID,
        priceMonthlyCents: 1999,  // $19.99
        priceYearlyCents: 19990,  // $199.90 (~$16.66/mo)
        tunnelEnabled: true,
        cloudGpuEnabled: true,
        cloudStorageEnabled: false,
        generationMinutesIncluded: 60,
        storageQuotaBytes: BigInt(0),
        memberQuota: 10,
        voiceProfileQuota: 20,
        prioritySupport: true,
        advancedAnalytics: false,
      },
      {
        name: 'Cloud Access — Legacy',
        planType: PlanType.CLOUD,
        priceMonthlyCents: 3999,  // $39.99
        priceYearlyCents: 39990,  // $399.90 (~$33.33/mo)
        tunnelEnabled: false,
        cloudGpuEnabled: true,
        cloudStorageEnabled: true,
        generationMinutesIncluded: 120,
        storageQuotaBytes: BigInt(10 * 1024 * 1024 * 1024), // 10GB
        memberQuota: 20,
        voiceProfileQuota: 50,
        prioritySupport: true,
        advancedAnalytics: true,
      },
    ]

    const results = []
    for (const plan of plans) {
      const created = await prisma.plan.upsert({
        where: { name: plan.name },
        update: {},
        create: plan,
      })
      results.push({ id: created.id, name: created.name, planType: created.planType })
    }

    // Also ensure every familyspace without a subscription gets the Free plan
    const freePlan = await prisma.plan.findFirst({ where: { planType: PlanType.FREE } })
    if (freePlan) {
      const spacesWithoutSub = await prisma.familyspace.findMany({
        where: {
          subscriptions: { none: {} },
        },
        select: { id: true, name: true },
      })

      for (const space of spacesWithoutSub) {
        await prisma.subscription.create({
          data: {
            familyspaceId: space.id,
            planId: freePlan.id,
            billingStatus: 'ACTIVE',
          },
        })
      }

      logger.info(`[seed-plans] Created subscriptions for ${spacesWithoutSub.length} familyspaces without one`)
      return res.status(200).json({
        success: true,
        data: {
          plans: results,
          backfilledFamilyspaces: spacesWithoutSub.map(s => ({ id: s.id, name: s.name })),
        },
      })
    }

    return res.status(200).json({
      success: true,
      data: { plans: results },
    })
  } catch (error) {
    logger.error('[seed-plans] Failed to seed plans:', error)
    return res.status(500).json({ success: false, error: 'Failed to seed plans' })
  }
}
