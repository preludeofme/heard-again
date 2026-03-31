import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'

export default apiHandler({
  // POST /api/stories/[id]/favorite - Favorite a story
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const storyId = req.query.id as string

    const story = await prisma.story.findFirst({
      where: { id: storyId, workspaceId: user.workspaceId },
    })
    if (!story) throw Errors.notFound('Story')

    const existing = await prisma.userStoryFavorite.findUnique({
      where: { userId_storyId: { userId: user.id, storyId } },
    })

    if (existing) {
      return successResponse(res, { favorited: true, message: 'Already favorited' })
    }

    await prisma.userStoryFavorite.create({
      data: { userId: user.id, storyId },
    })

    return successResponse(res, { favorited: true }, 201)
  },

  // DELETE /api/stories/[id]/favorite - Unfavorite a story
  DELETE: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const storyId = req.query.id as string

    await prisma.userStoryFavorite.deleteMany({
      where: { userId: user.id, storyId },
    })

    return successResponse(res, { favorited: false })
  },
})
