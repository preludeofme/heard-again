import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export default apiHandler({
  // GET /api/export/jobs/[id]/download - Download completed export artifact
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'VIEWER')

    const exportJobId = req.query.id as string

    const job = await prisma.exportJob.findFirst({
      where: {
        id: exportJobId,
        familyspaceId: user.familyspaceId,
      },
      select: {
        id: true,
        status: true,
        outputAssetId: true,
      },
    })

    if (!job) {
      throw Errors.notFound('ExportJob')
    }

    if (!job.outputAssetId || job.status !== 'COMPLETED') {
      throw Errors.badRequest('Export is not ready for download yet')
    }

    return successResponse(res, {
      jobId: job.id,
      status: job.status,
      outputAssetId: job.outputAssetId,
      downloadUrl: `/api/assets/${job.outputAssetId}/download`,
    })
  },
})
