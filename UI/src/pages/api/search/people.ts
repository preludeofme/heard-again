import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/search/people?q=... - Search people subset endpoint
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const query = ((req.query.q as string) || '').trim()
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50)

    if (!query) {
      return successResponse(res, { people: [], totalResults: 0 })
    }

    const people = await prisma.person.findMany({
      where: {
        familyspaceId: user.familyspaceId,
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
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: limit,
    })

    return successResponse(res, {
      people,
      totalResults: people.length,
    })
  },
})
