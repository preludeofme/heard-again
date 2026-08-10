import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const approveSchema = z.object({
  claimId: z.string().uuid(),
  resolutionNotes: z.string().optional(),
})

export default apiHandler({
  // POST /api/legacy-claims/approve - Approve a claim (Admin only)
  POST: async (req, res) => {
    // 1. Ensure user is a global admin
    const adminUser = await requireAdmin(req, res)

    const parsed = approveSchema.safeParse(req.body)
    if (!parsed.success) {
      throw Errors.badRequest('claimId is required and must be a UUID')
    }

    const { claimId, resolutionNotes } = parsed.data

    // 2. Fetch the claim details
    const claim = await prisma.legacyClaim.findUnique({
      where: { id: claimId },
      include: {
        deceasedUser: {
          select: {
            id: true,
            email: true,
            linkedPersonId: true,
          },
        },
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

    if (claim.status !== 'COOLING_OFF') {
      throw Errors.badRequest(`This claim cannot be approved because it is in status: ${claim.status}`)
    }

    const deceasedUserId = claim.deceasedUserId
    const claimantId = claim.claimantId

    // 3. Process the transition in a transaction
    await prisma.$transaction(async (tx) => {
      // A. Update the claim status
      await tx.legacyClaim.update({
        where: { id: claimId },
        data: {
          status: 'APPROVED',
          resolvedAt: new Date(),
          resolutionNotes: resolutionNotes || 'Approved by system administrator after verification.',
        },
      })

      // B. Mark the deceased user account as DECEASED
      await tx.user.update({
        where: { id: deceasedUserId },
        data: { status: 'DECEASED' },
      })

      // C. Update the deceased user's linked Person in the family tree
      if (claim.deceasedUser.linkedPersonId) {
        await tx.person.update({
          where: { id: claim.deceasedUser.linkedPersonId },
          data: {
            isDeceased: true,
            deathDate: new Date(), // Set approximation of passing if deathDate not set
          },
        })
      }

      // D. Find all Familyspaces owned by the deceased user
      const ownedSpaces = await tx.familyspace.findMany({
        where: { ownerId: deceasedUserId },
        select: { id: true },
      })

      for (const space of ownedSpaces) {
        // E. Transfer ownership of the Familyspace
        await tx.familyspace.update({
          where: { id: space.id },
          data: { ownerId: claimantId },
        })

        // F. Update or create Successor's membership in this space with role OWNER
        const claimantMembership = await tx.membership.findUnique({
          where: {
            familyspaceId_userId: {
              familyspaceId: space.id,
              userId: claimantId,
            },
          },
        })

        if (claimantMembership) {
          await tx.membership.update({
            where: { id: claimantMembership.id },
            data: { role: 'OWNER', status: 'ACTIVE' },
          })
        } else {
          await tx.membership.create({
            data: {
              familyspaceId: space.id,
              userId: claimantId,
              role: 'OWNER',
              status: 'ACTIVE',
            },
          })
        }

        // G. Demote deceased user's membership to LEGACY role
        const deceasedMembership = await tx.membership.findUnique({
          where: {
            familyspaceId_userId: {
              familyspaceId: space.id,
              userId: deceasedUserId,
            },
          },
        })

        if (deceasedMembership) {
          await tx.membership.update({
            where: { id: deceasedMembership.id },
            data: { role: 'LEGACY' },
          })
        }
      }
    })

    // Log the successful transition
    await prisma.auditLog.create({
      data: {
        familyspaceId: '',
        actorId: adminUser.id,
        actorType: 'USER',
        action: 'legacy_claim_approved_takeover_executed',
        resourceType: 'User',
        resourceId: deceasedUserId,
        metadata: {
          message: `Admin ${adminUser.email} approved claim ${claimId}. Account ${claim.deceasedUser.email} is DECEASED. Control transferred to ${claim.claimant.email}.`,
        },
      },
    }).catch(() => {})

    return successResponse(res, {
      approved: true,
      takeoverCompleted: true,
    })
  },
})
