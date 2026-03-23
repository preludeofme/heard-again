import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/search?q=... - Global search across stories, people, and assets
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const query = (req.query.q as string || '').trim()
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50)

    if (!query) {
      return successResponse(res, { stories: [], people: [], assets: [] })
    }

    const searchPattern = `%${query}%`

    const [stories, people, assets] = await Promise.all([
      prisma.story.findMany({
        where: {
          workspaceId: user.workspaceId,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
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
          subject: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      prisma.person.findMany({
        where: {
          workspaceId: user.workspaceId,
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { displayName: { contains: query, mode: 'insensitive' } },
            { nickname: { contains: query, mode: 'insensitive' } },
            { bio: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          personType: true,
          isDeceased: true,
          avatarAssetId: true,
        },
        orderBy: { firstName: 'asc' },
        take: limit,
      }),
      prisma.asset.findMany({
        where: {
          workspaceId: user.workspaceId,
          OR: [
            { originalName: { contains: query, mode: 'insensitive' } },
            { transcript: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          originalName: true,
          assetType: true,
          mimeType: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ])

    return successResponse(res, {
      stories,
      people,
      assets,
      totalResults: stories.length + people.length + assets.length,
    })
  },
})
