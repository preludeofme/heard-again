import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * Downgrade a familyspace to the FREE plan and clear its Stripe subscription
 * linkage. This is the single source of truth for "this familyspace no
 * longer has a paid Stripe subscription" — used both by the
 * `customer.subscription.deleted` webhook handler (the normal path) and by
 * any endpoint that discovers, via a direct Stripe API call, that a
 * subscription has already reached a terminal state before our webhook got
 * to it (webhook delivery can lag or fail transiently — e.g. during a
 * database outage — leaving the local `Subscription` row stale relative to
 * Stripe's actual state).
 */
export async function downgradeFamilyspaceToFreePlan(
  subscriptionId: string,
  familyspaceId: string
): Promise<void> {
  const freePlan = await prisma.plan.findFirst({
    where: { planType: 'FREE', isActive: true },
  })

  if (!freePlan) {
    logger.error('[Billing] No active FREE plan found — cannot downgrade familyspace', { familyspaceId })
    return
  }

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      planId: freePlan.id,
      billingStatus: 'ACTIVE',
      stripeSubscriptionId: null,
      cancelAtPeriodEnd: false,
      renewalDate: null,
      cancelledAt: new Date(),
    },
  })

  await prisma.familyspace.update({
    where: { id: familyspaceId },
    data: {
      planType: 'FREE',
      tunnelEnabled: false,
      cloudGpuEnabled: false,
      storageQuotaBytes: BigInt(0),
      generationMinuteQuota: 0,
    },
  })
}
