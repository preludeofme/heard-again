import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { withCSRFProtection } from '@/lib/security/csrf'

export default apiHandler({
  // PUT /api/voice/consent/[id] - Revoke voice consent
  PUT: withCSRFProtection(async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const consentId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const consent = await prisma.voiceConsent.findFirst({
      where: { id: consentId, workspaceId: user.workspaceId },
    })

    if (!consent) throw Errors.notFound('VoiceConsent')
    if (consent.revokedAt) throw Errors.badRequest('Consent already revoked')

    const updated = await prisma.voiceConsent.update({
      where: { id: consentId },
      data: { revokedAt: new Date() },
    })

    return successResponse(res, {
      id: updated.id,
      revokedAt: updated.revokedAt,
    })
  }),
})
