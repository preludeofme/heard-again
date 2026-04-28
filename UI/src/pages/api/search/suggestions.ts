import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { searchService } from '@/services'

export default apiHandler({
  // GET /api/search/suggestions?q=... - Lightweight autocomplete suggestions
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const query = ((req.query.q as string) || '').trim()
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 5, 20)

    const suggestions = await searchService.getSuggestions(
      user.familyspaceId,
      query,
      limit
    )

    return successResponse(res, { suggestions })
  },
})
