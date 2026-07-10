import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { storyService } from '@/services'

export default apiHandler({
  // GET /api/stories/pending - list publicly-submitted stories awaiting moderation
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const pending = await storyService.listPendingSubmissions(user.familyspaceId)
    return successResponse(res, pending)
  },
})
