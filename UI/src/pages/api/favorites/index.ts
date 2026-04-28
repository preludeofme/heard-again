import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/favorites - Get user's favorited stories
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const { page = '1', limit = '20' } = req.query

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20))
    const skip = (pageNum - 1) * pageSize

    const [favorites, total] = await Promise.all([
      prisma.userStoryFavorite.findMany({
        where: { userId: user.id },
        include: {
          story: {
            include: {
              subject: {
                select: { id: true, firstName: true, lastName: true },
              },
              speaker: {
                select: { id: true, firstName: true, lastName: true },
              },
              createdBy: {
                select: { id: true, displayName: true, email: true },
              },
              _count: {
                select: { comments: true, assets: true, favorites: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.userStoryFavorite.count({
        where: { userId: user.id },
      }),
    ])

    const result = favorites.map((f) => ({
      id: f.story.id,
      title: f.story.title,
      excerpt: f.story.excerpt || f.story.content.substring(0, 200),
      storyType: f.story.storyType,
      status: f.story.status,
      isPinned: f.story.isPinned,
      tags: f.story.tags,
      subject: f.story.subject,
      speaker: f.story.speaker,
      createdBy: f.story.createdBy,
      hasAudio: !!f.story.generatedAudioAssetId,
      counts: f.story._count,
      favoritedAt: f.createdAt,
      createdAt: f.story.createdAt,
    }))

    return successResponse(res, {
      stories: result,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  },
})
