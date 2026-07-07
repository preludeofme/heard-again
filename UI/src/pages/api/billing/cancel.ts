import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { withRateLimit } from '@/lib/security/rate-limiter'

const handler = apiHandler({
  // POST /api/billing/cancel - Cancel subscription
  // Body: { immediate?: boolean } — defaults to cancelling at the end of the current
  // billing period (access continues until then). `immediate: true` cancels right away.
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'OWNER')

    const immediate = req.body?.immediate === true

    const subscription = await prisma.subscription.findUnique({
      where: { familyspaceId: user.familyspaceId },
      include: { plan: true },
    })

    if (!subscription) {
      throw Errors.notFound('Subscription')
    }

    if (subscription.billingStatus === 'CANCELLED') {
      throw Errors.badRequest('Subscription is already cancelled')
    }

    if (subscription.plan?.planType === 'FREE') {
      throw Errors.badRequest('Cannot cancel a free plan')
    }

    if (subscription.cancelAtPeriodEnd && !immediate) {
      throw Errors.badRequest('Subscription is already scheduled to cancel at the end of the billing period')
    }

    // No Stripe subscription on file — nothing to cancel upstream, just downgrade locally.
    if (!subscription.stripeSubscriptionId) {
      const downgraded = await downgradeToFree(subscription.id, user.familyspaceId)
      return successResponse(res, {
        subscription: downgraded,
        message: 'Subscription cancelled and downgraded to the free plan.',
      })
    }

    if (immediate) {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId)
      const downgraded = await downgradeToFree(subscription.id, user.familyspaceId)
      return successResponse(res, {
        subscription: downgraded,
        message: 'Subscription cancelled immediately and downgraded to the free plan.',
      })
    }

    // Default: schedule cancellation for the end of the current billing period.
    // The familyspace keeps its current plan/entitlements until Stripe actually ends
    // the subscription, at which point the `customer.subscription.deleted` webhook
    // downgrades it to FREE.
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
      },
    })

    return successResponse(res, {
      subscription: {
        id: updated.id,
        billingStatus: updated.billingStatus,
        cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
        renewalDate: updated.renewalDate,
      },
      message: updated.renewalDate
        ? `Subscription will cancel on ${updated.renewalDate.toISOString()}. You'll keep access until then.`
        : 'Subscription will cancel at the end of the current billing period.',
    })
  },
})

export default withRateLimit('billing', handler)

async function downgradeToFree(subscriptionId: string, familyspaceId: string) {
  const freePlan = await prisma.plan.findFirst({
    where: { planType: 'FREE', isActive: true },
  })

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      ...(freePlan ? { planId: freePlan.id } : {}),
      // Once downgraded, the familyspace has an active FREE subscription — `cancelledAt`
      // is kept as a record of when the paid plan ended, not a "no service" marker.
      billingStatus: freePlan ? 'ACTIVE' : 'CANCELLED',
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: null,
      renewalDate: null,
      cancelledAt: new Date(),
    },
  })

  if (freePlan) {
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

  return {
    id: updated.id,
    billingStatus: updated.billingStatus,
    cancelledAt: updated.cancelledAt,
  }
}
