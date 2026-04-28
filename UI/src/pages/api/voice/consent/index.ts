import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'
export default apiHandler({
  // POST /api/voice/consent - Record voice consent
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const { valid, errors } = validate(req.body, {
      personId: [rules.required, rules.uuid],
      consentType: [rules.required, rules.oneOf(['SELF', 'FAMILY_ATTESTATION', 'ESTATE_REPRESENTATIVE', 'OTHER'])],
    })
    if (!valid) throw Errors.badRequest('Validation failed', errors)

    const {
      personId, consentType, attestationText,
      allowsGeneration = true, allowsCloudProcessing = false, allowsSharing = false,
    } = req.body

    // Verify person belongs to familyspace
    const person = await prisma.person.findFirst({
      where: { id: personId, familyspaceId: user.familyspaceId },
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
        familyspaceId: user.familyspaceId,
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
