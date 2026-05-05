import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/search/stories?q=... - Search stories subset endpoint
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const query = ((req.query.q as string) || '').trim()
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50)

    if (!query) {
      return successResponse(res, { stories: [], totalResults: 0 })
    }

    const tokens = query.split(/\s+/).filter(Boolean)
    const where: any = { familyspaceId: user.familyspaceId }

    if (tokens.length > 0) {
      where.AND = tokens.map(token => ({
        OR: [
          { title: { contains: token, mode: 'insensitive' } },
          { content: { contains: token, mode: 'insensitive' } },
          { excerpt: { contains: token, mode: 'insensitive' } },
          { tags: { hasSome: [token] } },
        ],
      }))
    }

    const stories = await prisma.story.findMany({
      where,
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
