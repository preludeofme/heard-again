import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { storyService } from '@/services'
import { isShareExpiryOption } from '@/lib/security/share-tokens'

export default apiHandler({
  // POST /api/stories/[id]/share - create or refresh a public share link
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const storyId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const expiresIn = req.body?.expiresIn
    if (!isShareExpiryOption(expiresIn)) {
      throw Errors.badRequest('expiresIn must be one of: never, 24h, 7d, 30d')
    }

    const { token, expiresAt } = await storyService.createShareLink(
      storyId,
      user.familyspaceId,
      user.id,
      expiresIn
    )

    return successResponse(res, { token, expiresAt })
  },

  // DELETE /api/stories/[id]/share - revoke the public share link
  DELETE: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const storyId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    await storyService.revokeShareLink(storyId, user.familyspaceId, user.id)
    return successResponse(res, { revoked: true })
  },
})
