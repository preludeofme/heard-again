import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { withCSRFProtection } from '@/lib/security/csrf'

export default apiHandler({
  // POST /api/billing/cancel - Cancel subscription
  POST: withCSRFProtection(async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'OWNER')

    const subscription = await prisma.subscription.findUnique({
      where: { workspaceId: user.workspaceId },
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

    // Downgrade workspace to free plan
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

      await prisma.workspace.update({
        where: { id: user.workspaceId },
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
      message: 'Subscription cancelled successfully. Your workspace has been downgraded to the free plan.',
    })
  },
})
