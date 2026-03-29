import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/people/[id]/voice-consent - Get consent status for a person
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const personId = req.query.id as string

    const person = await prisma.person.findFirst({
      where: { id: personId, workspaceId: user.workspaceId },
    })
    if (!person) throw Errors.notFound('Person')

    const consents = await prisma.voiceConsent.findMany({
      where: { personId },
      include: {
        grantedByUser: {
          select: { id: true, displayName: true, email: true },
        },
      },
      orderBy: { recordedAt: 'desc' },
    })

    const activeConsent = consents.find((c) => !c.revokedAt)

    return successResponse(res, {
      hasActiveConsent: !!activeConsent,
      activeConsent: activeConsent
        ? {
            id: activeConsent.id,
            consentType: activeConsent.consentType,
            attestationText: activeConsent.attestationText,
            allowsGeneration: activeConsent.allowsGeneration,
            allowsCloudProcessing: activeConsent.allowsCloudProcessing,
            allowsSharing: activeConsent.allowsSharing,
            recordedAt: activeConsent.recordedAt,
            grantedBy: activeConsent.grantedByUser,
          }
        : null,
      history: consents.map((c) => ({
        id: c.id,
        consentType: c.consentType,
        recordedAt: c.recordedAt,
        revokedAt: c.revokedAt,
        grantedBy: c.grantedByUser,
      })),
    })
  },
})
