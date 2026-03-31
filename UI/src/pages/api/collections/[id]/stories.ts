import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // POST /api/collections/[id]/stories - Add a story to collection
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const collectionId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, workspaceId: user.workspaceId },
    })
    if (!collection) throw Errors.notFound('Collection')

    const { storyId } = req.body
    if (!storyId) throw Errors.badRequest('storyId is required')

    const story = await prisma.story.findFirst({
      where: { id: storyId, workspaceId: user.workspaceId },
    })
    if (!story) throw Errors.notFound('Story')

    // Check if already in collection
    const existing = await prisma.collectionStory.findUnique({
      where: { collectionId_storyId: { collectionId, storyId } },
    })
    if (existing) {
      return successResponse(res, { message: 'Story already in collection' })
    }

    const maxSort = await prisma.collectionStory.aggregate({
      where: { collectionId },
      _max: { sortOrder: true },
    })

    const collectionStory = await prisma.collectionStory.create({
      data: {
        collectionId,
        storyId,
        addedById: user.id,
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
      },
    })

    return successResponse(res, { id: collectionStory.id }, 201)
  },

  // DELETE /api/collections/[id]/stories - Remove a story from collection
  DELETE: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const collectionId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const { storyId } = req.body
    if (!storyId) throw Errors.badRequest('storyId is required')

    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, workspaceId: user.workspaceId },
    })
    if (!collection) throw Errors.notFound('Collection')

    await prisma.collectionStory.deleteMany({
      where: { collectionId, storyId },
    })

    return successResponse(res, { removed: true })
  },
})
