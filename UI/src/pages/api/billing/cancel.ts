import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
export default apiHandler({
  // POST /api/billing/cancel - Cancel subscription
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'OWNER')

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

    // For FREE plan, just return message
    if (subscription.plan?.planType === 'FREE') {
      throw Errors.badRequest('Cannot cancel a free plan')
    }

    // In production, this would cancel the Stripe subscription
    // For now, simulate cancellation
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        billingStatus: 'CANCELLED',
        cancelledAt: new Date(),
      },
    })

    // Downgrade familyspace to free plan
    const freePlan = await prisma.plan.findFirst({
      where: { planType: 'FREE', isActive: true },
    })

    if (freePlan) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: freePlan.id,
          billingStatus: 'ACTIVE',
          stripeSubscriptionId: null,
          renewalDate: null,
          cancelledAt: null,
        },
      })

      await prisma.familyspace.update({
        where: { id: user.familyspaceId },
        data: {
          planType: 'FREE',
          tunnelEnabled: false,
          cloudGpuEnabled: false,
          storageQuotaBytes: BigInt(0),
          generationMinuteQuota: 0,
        },
      })
    }

    return successResponse(res, {
      subscription: {
        id: updatedSubscription.id,
        billingStatus: 'CANCELLED',
        cancelledAt: updatedSubscription.cancelledAt,
      },
      message: 'Subscription cancelled successfully. Your familyspace has been downgraded to the free plan.',
    })
  },
})
