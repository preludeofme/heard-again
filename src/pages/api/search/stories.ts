import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/search/stories?q=... - Search stories subset endpoint
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const query = ((req.query.q as string) || '').trim()
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50)

    if (!query) {
      return successResponse(res, { stories: [], totalResults: 0 })
    }

    const stories = await prisma.story.findMany({
      where: {
        workspaceId: user.workspaceId,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
          { excerpt: { contains: query, mode: 'insensitive' } },
          { tags: { hasSome: [query] } },
        ],
      },
      select: {
        id: true,
        title: true,
        excerpt: true,
        storyType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        subject: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
    })

    return successResponse(res, {
      stories,
      totalResults: stories.length,
    })
  },
})
