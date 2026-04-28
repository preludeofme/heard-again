import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
export default apiHandler({
  // PUT /api/voice/consent/[id] - Revoke voice consent
  PUT: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const consentId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const consent = await prisma.voiceConsent.findFirst({
      where: { id: consentId, familyspaceId: user.familyspaceId },
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
  },
})
