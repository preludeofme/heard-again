import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/export/jobs - List export jobs for current workspace
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'VIEWER')

    const jobs = await prisma.exportJob.findMany({
      where: {
        workspaceId: user.workspaceId,
      },
      include: {
        outputAsset: {
          select: {
            id: true,
            originalName: true,
            sizeBytes: true,
            mimeType: true,
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
        exportType: job.exportType,
        status: job.status,
        errorMessage: job.errorMessage,
        outputAssetId: job.outputAssetId,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        downloadUrl: job.outputAssetId ? `/api/export/jobs/${job.id}/download` : null,
        outputAsset: job.outputAsset
          ? {
              id: job.outputAsset.id,
              originalName: job.outputAsset.originalName,
              sizeBytes: Number(job.outputAsset.sizeBytes),
              mimeType: job.outputAsset.mimeType,
              createdAt: job.outputAsset.createdAt,
            }
          : null,
      })),
    })
  },
})
