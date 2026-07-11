import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { apiHandler, successResponse, Errors, AppError } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { withRateLimit } from '@/lib/security/rate-limiter'
import { downgradeFamilyspaceToFreePlan } from '@/server/services/billing-reconcile'
import { logger } from '@/lib/logger'

const ALREADY_ENDED_MESSAGE =
  'This subscription has already ended and can no longer be resumed — choose a plan to subscribe again.'

const handler = apiHandler({
  // POST /api/billing/resume - Undo a pending "cancel at period end"
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'OWNER')

    const subscription = await prisma.subscription.findUnique({
      where: { familyspaceId: user.familyspaceId },
    })

    if (!subscription) {
      throw Errors.notFound('Subscription')
    }

    if (!subscription.cancelAtPeriodEnd || !subscription.stripeSubscriptionId) {
      throw Errors.badRequest('Subscription is not scheduled to cancel')
    }

    // Our local row is only as fresh as the last webhook we successfully
    // processed. `customer.subscription.deleted` delivery can lag or fail
    // transiently (e.g. during a database outage), leaving this row stale
    // — still showing `cancelAtPeriodEnd: true` with a subscription id —
    // after the subscription has actually already fully terminated on
    // Stripe's side. Verify against Stripe's live state before mutating
    // rather than trusting the local cache, and self-heal if it's stale.
    try {
      const liveSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)
      if (liveSubscription.status === 'canceled') {
        await downgradeFamilyspaceToFreePlan(subscription.id, user.familyspaceId)
        throw Errors.badRequest(ALREADY_ENDED_MESSAGE)
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err // the badRequest we threw above
      logger.warn(
        `[Billing] Could not retrieve subscription ${subscription.stripeSubscriptionId} from Stripe during resume: ${err.message}`
      )
      await downgradeFamilyspaceToFreePlan(subscription.id, user.familyspaceId)
      throw Errors.badRequest(ALREADY_ENDED_MESSAGE)
    }

    try {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false,
      })
    } catch (err: any) {
      // Belt-and-suspenders: Stripe can still reject the update between our
      // retrieve() above and this call (e.g. it terminated in that window).
      logger.warn(`[Billing] Stripe rejected resume for ${subscription.stripeSubscriptionId}: ${err.message}`)
      await downgradeFamilyspaceToFreePlan(subscription.id, user.familyspaceId)
      throw Errors.badRequest(ALREADY_ENDED_MESSAGE)
    }

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
    })

    return successResponse(res, {
      subscription: {
        id: updated.id,
        billingStatus: updated.billingStatus,
        cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
      },
      message: 'Subscription resumed — it will continue renewing as normal.',
    })
  },
})

export default withRateLimit('billing', handler)
