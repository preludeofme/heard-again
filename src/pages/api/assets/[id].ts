import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/assets/[id] - Get asset details
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const assetId = req.query.id as string

    const asset = await prisma.asset.findFirst({
      where: { id: assetId, workspaceId: user.workspaceId },
      include: {
        uploadedBy: {
          select: { id: true, displayName: true, email: true },
        },
        storyAssets: {
          include: {
            story: { select: { id: true, title: true } },
          },
        },
      },
    })

    if (!asset) throw Errors.notFound('Asset')

    return successResponse(res, {
      id: asset.id,
      filename: asset.filename,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      sizeBytes: Number(asset.sizeBytes),
      assetType: asset.assetType,
      storagePath: asset.storagePath,
      durationSeconds: asset.durationSeconds,
      width: asset.width,
      height: asset.height,
      transcript: asset.transcript,
      processingStatus: asset.processingStatus,
      processingError: asset.processingError,
      uploadedBy: asset.uploadedBy,
      stories: asset.storyAssets.map((sa) => ({
        storyId: sa.story.id,
        storyTitle: sa.story.title,
        role: sa.assetRole,
      })),
      createdAt: asset.createdAt,
    })
  },

  // DELETE /api/assets/[id] - Delete asset
  DELETE: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const assetId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const asset = await prisma.asset.findFirst({
      where: { id: assetId, workspaceId: user.workspaceId },
    })
    if (!asset) throw Errors.notFound('Asset')

    await prisma.asset.delete({ where: { id: assetId } })

    return successResponse(res, { deleted: true })
  },
})
