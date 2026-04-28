import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/billing/subscription - Get current subscription
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'VIEWER')

    const subscription = await prisma.subscription.findUnique({
      where: { familyspaceId: user.familyspaceId },
      include: { plan: true },
    })

    if (!subscription) {
      throw Errors.notFound('Subscription')
    }

    return successResponse(res, {
      subscription: {
        id: subscription.id,
        billingStatus: subscription.billingStatus,
        renewalDate: subscription.renewalDate,
        cancelledAt: subscription.cancelledAt,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripeCustomerId: subscription.stripeCustomerId,
        usage: {
          generationMinutesUsed: subscription.generationMinutesUsed,
          storageBytesUsed: Number(subscription.storageBytesUsed),
          lastBillingResetAt: subscription.lastBillingResetAt,
        },
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
      },
      plan: subscription.plan ? {
        id: subscription.plan.id,
        name: subscription.plan.name,
        planType: subscription.plan.planType,
        pricing: {
          monthlyCents: subscription.plan.priceMonthlyCents,
          yearlyCents: subscription.plan.priceYearlyCents,
          monthlyDisplay: (subscription.plan.priceMonthlyCents / 100).toFixed(2),
          yearlyDisplay: subscription.plan.priceYearlyCents != null 
            ? (subscription.plan.priceYearlyCents / 100).toFixed(2) 
            : null,
        },
        entitlements: {
          tunnelEnabled: subscription.plan.tunnelEnabled,
          cloudGpuEnabled: subscription.plan.cloudGpuEnabled,
          cloudStorageEnabled: subscription.plan.cloudStorageEnabled,
          generationMinutesIncluded: subscription.plan.generationMinutesIncluded,
          storageQuotaBytes: Number(subscription.plan.storageQuotaBytes),
          memberQuota: subscription.plan.memberQuota,
          voiceProfileQuota: subscription.plan.voiceProfileQuota,
        },
        features: {
          prioritySupport: subscription.plan.prioritySupport,
          advancedAnalytics: subscription.plan.advancedAnalytics,
        },
      } : null,
    })
  },
})
