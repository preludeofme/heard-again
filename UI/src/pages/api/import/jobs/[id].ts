import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/import/jobs/[id] - Get import job status/details
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'VIEWER')

    const jobId = req.query.id as string

    const job = await prisma.importJob.findUnique({
      where: {
        id: jobId,
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

    const isImporter = job.importedById === user.id
    let hasAccess = isImporter

    if (!hasAccess) {
      const membership = await prisma.membership.findUnique({
        where: {
          familyspaceId_userId: {
            familyspaceId: job.familyspaceId,
            userId: user.id,
          },
        },
      })
      hasAccess = !!(membership && membership.status === 'ACTIVE')
    }

    if (!hasAccess) {
      throw Errors.notFound('ImportJob')
    }

    return successResponse(res, {
      id: job.id,
      sourceType: job.sourceType,
      status: job.status,
      errorMessage: job.errorMessage,
      sourceAssetId: job.sourceAssetId,
      triggerRunId: job.triggerRunId ?? null,
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
