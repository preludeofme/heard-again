import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/family-merge/proposals/[id] - Get a specific merge proposal
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'ADMIN')
    
    const { id } = req.query
    
    const proposal = await prisma.familyMergeProposal.findFirst({
      where: {
        id: id as string,
        OR: [
          { targetWorkspaceId: user.workspaceId },
          { sourceWorkspaceId: user.workspaceId }
        ]
      },
      include: {
        targetWorkspace: {
          select: { id: true, name: true, slug: true }
        },
        sourceWorkspace: {
          select: { id: true, name: true, slug: true }
        },
        proposedBy: {
          select: { id: true, name: true, email: true }
        },
        personMatches: {
          include: {
            targetPerson: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                birthDate: true,
                deathDate: true,
                sex: true
              }
            },
            sourcePerson: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                birthDate: true,
                deathDate: true,
                sex: true
              }
            }
          },
          orderBy: { matchScore: 'desc' }
        }
      }
    })
    
    if (!proposal) {
      throw Errors.notFound('FamilyMergeProposal')
    }
    
    return successResponse(res, { proposal })
  },

  // PATCH /api/family-merge/proposals/[id] - Update proposal status or matches
  PATCH: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'ADMIN')
    
    const { id } = req.query
    const { status, matchUpdates } = req.body
    
    const proposal = await prisma.familyMergeProposal.findFirst({
      where: {
        id: id as string,
        OR: [
          { targetWorkspaceId: user.workspaceId },
          { sourceWorkspaceId: user.workspaceId }
        ]
      }
    })
    
    if (!proposal) {
      throw Errors.notFound('FamilyMergeProposal')
    }
    
    // Can only update PENDING proposals
    if (proposal.status !== 'PENDING' && proposal.status !== 'APPROVED') {
      throw Errors.badRequest(`Cannot update proposal with status: ${proposal.status}`)
    }
    
    // Update match inclusions if provided
    if (matchUpdates && Array.isArray(matchUpdates) && matchUpdates.length > 0) {
      await prisma.$transaction(
        matchUpdates.map((update: { matchId: string; isIncluded: boolean }) =>
          prisma.familyMergePersonMatch.updateMany({
            where: {
              id: update.matchId,
              proposalId: id as string
            },
            data: {
              isIncluded: update.isIncluded,
              userOverride: true
            }
          })
        )
      )
    }
    
    // Update proposal status if provided
    if (status && ['APPROVED', 'REJECTED'].includes(status)) {
      await prisma.familyMergeProposal.update({
        where: { id: id as string },
        data: {
          status,
          reviewedAt: new Date(),
          reviewedById: user.id
        }
      })
    }
    
    // Return updated proposal
    const updatedProposal = await prisma.familyMergeProposal.findUnique({
      where: { id: id as string },
      include: {
        targetWorkspace: {
          select: { id: true, name: true, slug: true }
        },
        sourceWorkspace: {
          select: { id: true, name: true, slug: true }
        },
        proposedBy: {
          select: { id: true, name: true, email: true }
        },
        personMatches: {
          include: {
            targetPerson: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                birthDate: true,
                deathDate: true
              }
            },
            sourcePerson: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                birthDate: true,
                deathDate: true
              }
            }
          }
        }
      }
    })
    
    return successResponse(res, { proposal: updatedProposal })
  },

  // DELETE /api/family-merge/proposals/[id] - Delete a proposal
  DELETE: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'ADMIN')
    
    const { id } = req.query
    
    const proposal = await prisma.familyMergeProposal.findFirst({
      where: {
        id: id as string,
        OR: [
          { targetWorkspaceId: user.workspaceId },
          { sourceWorkspaceId: user.workspaceId }
        ]
      }
    })
    
    if (!proposal) {
      throw Errors.notFound('FamilyMergeProposal')
    }
    
    // Only allow deletion by proposal creator or target workspace owner
    if (proposal.proposedById !== user.id && proposal.targetWorkspaceId !== user.workspaceId) {
      throw Errors.forbidden('Only the proposal creator or target workspace admin can delete this proposal')
    }
    
    // Cannot delete already merged proposals
    if (proposal.status === 'MERGED') {
      throw Errors.badRequest('Cannot delete a completed merge')
    }
    
    await prisma.familyMergeProposal.delete({
      where: { id: id as string }
    })
    
    return successResponse(res, { message: 'Proposal deleted successfully' })
  }
})
