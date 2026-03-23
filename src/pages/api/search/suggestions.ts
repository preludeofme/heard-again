import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'

interface SearchSuggestion {
  id: string
  type: 'person' | 'story' | 'asset'
  label: string
  subtitle?: string
}

export default apiHandler({
  // GET /api/search/suggestions?q=... - Lightweight autocomplete suggestions
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const query = ((req.query.q as string) || '').trim()
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 5, 20)

    if (!query) {
      return successResponse(res, { suggestions: [] as SearchSuggestion[] })
    }

    const [people, stories, assets] = await Promise.all([
      prisma.person.findMany({
        where: {
          workspaceId: user.workspaceId,
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { displayName: { contains: query, mode: 'insensitive' } },
            { nickname: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          personType: true,
        },
        orderBy: { firstName: 'asc' },
        take: limit,
      }),
      prisma.story.findMany({
        where: {
          workspaceId: user.workspaceId,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          title: true,
          excerpt: true,
          storyType: true,
        },
        orderBy: { updatedAt: 'desc' },
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
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ])

    const personSuggestions: SearchSuggestion[] = people.map((person) => {
      const fullName = `${person.firstName || ''} ${person.lastName || ''}`.trim()
      const label = person.displayName || fullName || 'Unnamed person'

      return {
        id: person.id,
        type: 'person',
        label,
        subtitle: person.personType,
      }
    })

    const storySuggestions: SearchSuggestion[] = stories.map((story) => ({
      id: story.id,
      type: 'story',
      label: story.title,
      subtitle: story.excerpt || story.storyType,
    }))

    const assetSuggestions: SearchSuggestion[] = assets.map((asset) => ({
      id: asset.id,
      type: 'asset',
      label: asset.originalName,
      subtitle: asset.assetType,
    }))

    const suggestions = [...personSuggestions, ...storySuggestions, ...assetSuggestions]
      .slice(0, limit * 2)

    return successResponse(res, { suggestions })
  },
})
