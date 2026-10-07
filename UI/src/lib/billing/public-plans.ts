import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { formatMonthlyPrice } from './plan-display'
import { PUBLIC_PLAN_SLUGS } from './landing-plan-copy'
import type { PublicPlan } from './public-plans.types'

/**
 * Reads the cloud tiers the marketing pages advertise straight off the `Plan` rows,
 * so a price change in Stripe plus the row is the only edit needed.
 *
 * Inactive rows are included deliberately. An advertised tier we cannot sell yet
 * has to keep its price on the page but lose its checkout, and `isActive: false`
 * is where that state lives. The copy map doubles as the allowlist, so an internal
 * or experimental row can never leak onto the public page.
 */
export async function fetchPublicCloudPlans(): Promise<PublicPlan[]> {
  try {
    const rows = await prisma.plan.findMany({
      where: { slug: { in: [...PUBLIC_PLAN_SLUGS] } },
      orderBy: { priceMonthlyCents: 'asc' },
    })

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug as string,
      name: row.name,
      planType: row.planType,
      priceMonthlyCents: row.priceMonthlyCents,
      priceMonthlyDisplay: formatMonthlyPrice(row.priceMonthlyCents),
      generationMinutesIncluded: row.generationMinutesIncluded,
      storageQuotaBytes: Number(row.storageQuotaBytes),
      memberQuota: row.memberQuota,
      voiceProfileQuota: row.voiceProfileQuota,
      prioritySupport: row.prioritySupport,
      isAvailable: row.isActive && Boolean(row.stripePriceIdMonthly),
    }))
  } catch (error) {
    // A database outage must not 500 the landing page. The pricing section drops
    // its cards and says so rather than printing a price we cannot verify.
    logger.error('Failed to load public cloud plans for the pricing section', {
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}
