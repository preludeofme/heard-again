import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/import/jobs/[id] - Get import job status/details
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'VIEWER')

    const jobId = req.query.id as string

    const job = await prisma.importJob.findFirst({
      where: {
        id: jobId,
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
    })

    if (!job) {
      throw Errors.notFound('ImportJob')
    }

    return successResponse(res, {
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
    })
  },
})
