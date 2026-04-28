import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/billing/plans - List available active plans
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'VIEWER')

    const plans = await prisma.plan.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        priceMonthlyCents: 'asc',
      },
    })

    return successResponse(res, {
      plans: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        planType: plan.planType,
        pricing: {
          monthlyCents: plan.priceMonthlyCents,
          yearlyCents: plan.priceYearlyCents,
          monthlyDisplay: (plan.priceMonthlyCents / 100).toFixed(2),
          yearlyDisplay: plan.priceYearlyCents != null ? (plan.priceYearlyCents / 100).toFixed(2) : null,
        },
        entitlements: {
          tunnelEnabled: plan.tunnelEnabled,
          cloudGpuEnabled: plan.cloudGpuEnabled,
          cloudStorageEnabled: plan.cloudStorageEnabled,
          generationMinutesIncluded: plan.generationMinutesIncluded,
          storageQuotaBytes: Number(plan.storageQuotaBytes),
          memberQuota: plan.memberQuota,
          voiceProfileQuota: plan.voiceProfileQuota,
        },
        features: {
          prioritySupport: plan.prioritySupport,
          advancedAnalytics: plan.advancedAnalytics,
        },
      })),
    })
  },
})
