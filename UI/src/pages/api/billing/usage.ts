import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { formatBytes } from '@/lib/format'

export default apiHandler({
  // GET /api/billing/usage - Get usage stats for current billing period
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

    // Get asset storage usage
    const storageResult = await prisma.asset.aggregate({
      where: { familyspaceId: user.familyspaceId },
      _sum: { sizeBytes: true },
      _count: { id: true },
    })

    // Get voice generation usage
    const generationStats = await prisma.voiceGenerationJob.aggregate({
      where: {
        voiceProfile: { familyspaceId: user.familyspaceId },
        completedAt: {
          gte: subscription.lastBillingResetAt,
        },
        status: 'COMPLETED',
      },
      _sum: { durationSeconds: true },
      _count: { id: true },
    })

    // Get familyspace stats
    const familyspaceStats = await prisma.familyspace.findUnique({
      where: { id: user.familyspaceId },
      include: {
        _count: {
          select: {
            members: true,
            voiceProfiles: true,
            stories: true,
            assets: true,
          },
        },
      },
    })

    const storageBytesUsed = Number(storageResult._sum.sizeBytes || 0)
    const generationMinutesUsed = (generationStats._sum.durationSeconds || 0) / 60

    const plan = subscription.plan
    const storageQuota = plan ? Number(plan.storageQuotaBytes) : 0
    const generationQuota = plan ? plan.generationMinutesIncluded : 0

    return successResponse(res, {
      period: {
        startedAt: subscription.lastBillingResetAt,
        renewalDate: subscription.renewalDate,
      },
      usage: {
        storage: {
          bytesUsed: storageBytesUsed,
          bytesQuota: storageQuota,
          percentUsed: storageQuota > 0 ? Math.round((storageBytesUsed / storageQuota) * 100) : 0,
          filesCount: storageResult._count.id,
          formattedUsed: formatBytes(storageBytesUsed),
          formattedQuota: formatBytes(storageQuota),
        },
        generation: {
          minutesUsed: Math.round(generationMinutesUsed * 10) / 10,
          minutesQuota: generationQuota,
          percentUsed: generationQuota > 0 ? Math.round((generationMinutesUsed / generationQuota) * 100) : 0,
          jobsCount: generationStats._count.id,
        },
        members: {
          count: familyspaceStats?._count.members || 0,
          quota: plan?.memberQuota || 1,
        },
        voiceProfiles: {
          count: familyspaceStats?._count.voiceProfiles || 0,
          quota: plan?.voiceProfileQuota || 0,
        },
      },
      features: {
        tunnelEnabled: subscription.plan?.tunnelEnabled || false,
        cloudGpuEnabled: subscription.plan?.cloudGpuEnabled || false,
        cloudStorageEnabled: subscription.plan?.cloudStorageEnabled || false,
        prioritySupport: subscription.plan?.prioritySupport || false,
        advancedAnalytics: subscription.plan?.advancedAnalytics || false,
      },
    })
  },
})
