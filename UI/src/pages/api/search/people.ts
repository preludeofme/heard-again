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

    const tokens = query.split(/\s+/).filter(Boolean)
    const where: any = { familyspaceId: user.familyspaceId }

    if (tokens.length > 0) {
      where.AND = tokens.map(token => ({
        OR: [
          { firstName: { contains: token, mode: 'insensitive' } },
          { middleName: { contains: token, mode: 'insensitive' } },
          { lastName: { contains: token, mode: 'insensitive' } },
          { maidenName: { contains: token, mode: 'insensitive' } },
          { displayName: { contains: token, mode: 'insensitive' } },
          { nickname: { contains: token, mode: 'insensitive' } },
          { bio: { contains: token, mode: 'insensitive' } },
        ],
      }))
    }

    const people = await prisma.person.findMany({
      where,
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
