import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const cancelSchema = z.object({
  claimId: z.string().uuid(),
})

export default apiHandler({
  // POST /api/legacy-claims/cancel - Cancel a claim against the current user (proving they are alive)
  POST: async (req, res) => {
    const user = await getAuthUser(req, res)

    const parsed = cancelSchema.safeParse(req.body)
    if (!parsed.success) {
      throw Errors.badRequest('claimId is required and must be a UUID')
    }

    const { claimId } = parsed.data

    const claim = await prisma.legacyClaim.findUnique({
      where: { id: claimId },
      include: {
        claimant: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    })

    if (!claim) {
      throw Errors.notFound('Legacy claim not found')
    }

    // Security check: Only the user claimed to be deceased can cancel it
    if (claim.deceasedUserId !== user.id) {
      throw Errors.forbidden('You are not authorized to cancel this claim. Only the target account owner can reject a claim on their life.')
    }

    if (claim.status !== 'COOLING_OFF') {
      throw Errors.badRequest(`This claim cannot be cancelled because it is in status: ${claim.status}`)
    }

    // Run transaction: Cancel claim and suspend claimant for fraud/abuse
    await prisma.$transaction([
      // 1. Cancel the claim
      prisma.legacyClaim.update({
        where: { id: claimId },
        data: {
          status: 'CANCELLED',
          resolvedAt: new Date(),
          resolutionNotes: 'Claim cancelled by account owner (active user). Successor flagged for fraudulent claim.',
        },
      }),
      // 2. Suspend the fraudulent successor account
      prisma.user.update({
        where: { id: claim.claimantId },
        data: {
          status: 'SUSPENDED',
        },
      }),
    ])

    // Log security audit log for admin review
    // In a real app, we would log this in the AuditLog table too:
    await prisma.auditLog.create({
      data: {
        familyspaceId: user.defaultFamilyspaceId || '', // fallback to default
        actorId: user.id,
        actorType: 'USER',
        action: 'legacy_claim_cancelled_fraud_detected',
        resourceType: 'User',
        resourceId: claim.claimantId,
        metadata: {
          message: `User ${user.email} cancelled legacy claim ${claimId}. Claimant ${claim.claimant.email} suspended for fraud.`,
        },
      },
    }).catch(() => {
      // In case no default familyspace is set, suppress error to not block transaction success
    })

    return successResponse(res, {
      cancelled: true,
      claimantSuspended: true,
    })
  },
})
