import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { personService } from '@/services'
import { isShareExpiryOption } from '@/lib/security/share-tokens'

export default apiHandler({
  // POST /api/people/[id]/share - create or refresh a public profile link
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const personId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const expiresIn = req.body?.expiresIn
    if (!isShareExpiryOption(expiresIn)) {
      throw Errors.badRequest('expiresIn must be one of: never, 24h, 7d, 30d')
    }

    const { token, expiresAt } = await personService.createShareLink(
      personId,
      user.familyspaceId,
      user.id,
      expiresIn
    )

    return successResponse(res, { token, expiresAt })
  },

  // DELETE /api/people/[id]/share - revoke the public profile link
  DELETE: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const personId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    await personService.revokeShareLink(personId, user.familyspaceId, user.id)
    return successResponse(res, { revoked: true })
  },
})
