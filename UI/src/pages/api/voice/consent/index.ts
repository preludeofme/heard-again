import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'

export default apiHandler({
  // POST /api/voice/consent - Record voice consent
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const { valid, errors } = validate(req.body, {
      personId: [rules.required, rules.uuid],
      consentType: [rules.required, rules.oneOf(['SELF', 'FAMILY_ATTESTATION', 'ESTATE_REPRESENTATIVE', 'OTHER'])],
    })
    if (!valid) throw Errors.badRequest('Validation failed', errors)

    const {
      personId, consentType, attestationText,
      allowsGeneration = true, allowsCloudProcessing = false, allowsSharing = false,
    } = req.body

    // Verify person belongs to workspace
    const person = await prisma.person.findFirst({
      where: { id: personId, workspaceId: user.workspaceId },
    })
    if (!person) throw Errors.notFound('Person')

    // Check for existing active consent (no revokedAt means active)
    const existing = await prisma.voiceConsent.findFirst({
      where: { personId, revokedAt: null },
    })
    if (existing) {
      return successResponse(res, { message: 'Active consent already exists', consent: existing })
    }

    const consent = await prisma.voiceConsent.create({
      data: {
        workspaceId: user.workspaceId,
        personId,
        grantedByUserId: user.id,
        consentType,
        attestationText: attestationText || null,
        allowsGeneration,
        allowsCloudProcessing,
        allowsSharing,
      },
    })

    return successResponse(res, {
      id: consent.id,
      personId: consent.personId,
      consentType: consent.consentType,
      recordedAt: consent.recordedAt,
    }, 201)
  },
})
