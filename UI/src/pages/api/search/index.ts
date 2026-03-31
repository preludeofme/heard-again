import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'
import { searchService } from '@/services'

export default apiHandler({
  // GET /api/search?q=... - Global search across stories, people, and assets
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const query = ((req.query.q as string) || '').trim()
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 50)

    const results = await searchService.search({
      workspaceId: user.workspaceId,
      query,
      limit,
    })

    return successResponse(res, results)
  },
})
