import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/billing/usage - Get usage stats for current billing period
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'VIEWER')

    const subscription = await prisma.subscription.findUnique({
      where: { workspaceId: user.workspaceId },
      include: { plan: true },
    })

    if (!subscription) {
      throw Errors.notFound('Subscription')
    }

    // Get asset storage usage
    const storageResult = await prisma.asset.aggregate({
      where: { workspaceId: user.workspaceId },
      _sum: { sizeBytes: true },
      _count: { id: true },
    })

    // Get voice generation usage
    const generationStats = await prisma.voiceGenerationJob.aggregate({
      where: {
        voiceProfile: { workspaceId: user.workspaceId },
        completedAt: {
          gte: subscription.lastBillingResetAt,
        },
        status: 'COMPLETED',
      },
      _sum: { durationSeconds: true },
      _count: { id: true },
    })

    // Get workspace stats
    const workspaceStats = await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
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
          count: workspaceStats?._count.members || 0,
          quota: plan?.memberQuota || 1,
        },
        voiceProfiles: {
          count: workspaceStats?._count.voiceProfiles || 0,
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
