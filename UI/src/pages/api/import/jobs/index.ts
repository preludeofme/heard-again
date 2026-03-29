import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/import/jobs - List import jobs for current workspace
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'VIEWER')

    const jobs = await prisma.importJob.findMany({
      where: {
        workspaceId: user.workspaceId,
      },
      include: {
        sourceAsset: {
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    })

    return successResponse(res, {
      jobs: jobs.map((job) => ({
        id: job.id,
        sourceType: job.sourceType,
        status: job.status,
        errorMessage: job.errorMessage,
        sourceAssetId: job.sourceAssetId,
        resultSummary: job.resultSummary,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        sourceAsset: job.sourceAsset
          ? {
              id: job.sourceAsset.id,
              originalName: job.sourceAsset.originalName,
              mimeType: job.sourceAsset.mimeType,
              sizeBytes: Number(job.sourceAsset.sizeBytes),
              createdAt: job.sourceAsset.createdAt,
            }
          : null,
      })),
    })
  },
})
