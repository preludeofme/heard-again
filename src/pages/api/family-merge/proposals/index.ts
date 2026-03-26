import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { findPersonMatches } from '../analyze'

export default apiHandler({
  // GET /api/family-merge/proposals - List all merge proposals for the workspace
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'ADMIN')
    
    const proposals = await prisma.familyMergeProposal.findMany({
      where: {
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
        _count: {
          select: { personMatches: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return successResponse(res, { proposals })
  },

  // POST /api/family-merge/proposals - Create a new merge proposal
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'ADMIN')
    
    const { sourceWorkspaceId, minScore = 0.6, autoApprove = false } = req.body
    
    if (!sourceWorkspaceId) {
      throw Errors.badRequest('sourceWorkspaceId is required')
    }
    
    if (sourceWorkspaceId === user.workspaceId) {
      throw Errors.badRequest('Cannot merge a workspace with itself')
    }
    
    // Verify user has access to source workspace
    const sourceMembership = await prisma.membership.findFirst({
      where: {
        userId: user.id,
        workspaceId: sourceWorkspaceId,
        status: 'ACTIVE',
        role: { in: ['ADMIN', 'OWNER'] }
      }
    })
    
    if (!sourceMembership) {
      throw Errors.forbidden('You must be an ADMIN or OWNER of the source workspace to propose a merge')
    }
    
    // Check for existing pending proposal
    const existingProposal = await prisma.familyMergeProposal.findFirst({
      where: {
        targetWorkspaceId: user.workspaceId,
        sourceWorkspaceId,
        status: { in: ['PENDING', 'APPROVED'] }
      }
    })
    
    if (existingProposal) {
      throw Errors.conflict(`An existing proposal (${existingProposal.status}) already exists for this workspace pair`)
    }
    
    // Find matches
    const matches = await findPersonMatches(
      user.workspaceId,
      sourceWorkspaceId,
      minScore
    )
    
    // Get source person count
    const totalSourcePeople = await prisma.person.count({
      where: { workspaceId: sourceWorkspaceId }
    })
    
    // Calculate overall match score
    const overallMatchScore = matches.length > 0
      ? matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length
      : 0
    
    // Create the proposal with matches
    const proposal = await prisma.$transaction(async (tx) => {
      // Create the proposal
      const newProposal = await tx.familyMergeProposal.create({
        data: {
          targetWorkspaceId: user.workspaceId,
          sourceWorkspaceId,
          proposedById: user.id,
          status: autoApprove ? 'APPROVED' : 'PENDING',
          overallMatchScore,
          matchedPeopleCount: matches.length,
          totalSourcePeople,
          reviewedAt: autoApprove ? new Date() : null,
          reviewedById: autoApprove ? user.id : null
        }
      })
      
      // Create person matches
      if (matches.length > 0) {
        await tx.familyMergePersonMatch.createMany({
          data: matches.map(match => ({
            proposalId: newProposal.id,
            targetPersonId: match.targetPersonId,
            sourcePersonId: match.sourcePersonId,
            matchScore: match.matchScore,
            matchReason: match.matchReason,
            isIncluded: true,
            userOverride: false,
            status: autoApprove ? 'APPROVED' : 'PENDING'
          }))
        })
      }
      
      return newProposal
    })
    
    // Fetch the complete proposal with matches
    const completeProposal = await prisma.familyMergeProposal.findUnique({
      where: { id: proposal.id },
      include: {
        targetWorkspace: {
          select: { id: true, name: true, slug: true }
        },
        sourceWorkspace: {
          select: { id: true, name: true, slug: true }
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
    
    return successResponse(res, {
      proposal: completeProposal,
      summary: {
        matchedPeopleCount: matches.length,
        totalSourcePeople,
        overallMatchScore
      }
    }, 201)
  }
})
