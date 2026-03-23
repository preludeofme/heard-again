import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/stories/[id]/assets - List assets for a story
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const storyId = req.query.id as string

    const story = await prisma.story.findFirst({
      where: { id: storyId, workspaceId: user.workspaceId },
    })
    if (!story) throw Errors.notFound('Story')

    const storyAssets = await prisma.storyAsset.findMany({
      where: { storyId },
      include: {
        asset: {
          select: {
            id: true, filename: true, originalName: true, mimeType: true,
            assetType: true, storagePath: true, durationSeconds: true,
            sizeBytes: true, transcript: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    const result = storyAssets.map((sa) => ({
      id: sa.id,
      role: sa.assetRole,
      sortOrder: sa.sortOrder,
      caption: sa.caption,
      asset: {
        ...sa.asset,
        sizeBytes: Number(sa.asset.sizeBytes),
      },
    }))

    return successResponse(res, result)
  },

  // POST /api/stories/[id]/assets - Attach an asset to a story
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const storyId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const story = await prisma.story.findFirst({
      where: { id: storyId, workspaceId: user.workspaceId },
    })
    if (!story) throw Errors.notFound('Story')

    const { assetId, assetRole = 'ATTACHMENT', caption } = req.body

    if (!assetId) throw Errors.badRequest('assetId is required')

    // Verify asset belongs to workspace
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, workspaceId: user.workspaceId },
    })
    if (!asset) throw Errors.notFound('Asset')

    // Get next sort order
    const maxSort = await prisma.storyAsset.aggregate({
      where: { storyId },
      _max: { sortOrder: true },
    })

    const storyAsset = await prisma.storyAsset.create({
      data: {
        storyId,
        assetId,
        assetRole,
        caption: caption || null,
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
      },
    })

    return successResponse(res, { id: storyAsset.id }, 201)
  },
})
