import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { withRateLimit } from '@/lib/security/rate-limiter'

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

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    })

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
