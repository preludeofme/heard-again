import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUser, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'
import { updateFamilyspaceSchema } from '@/schemas'

export default apiHandler({
  // GET /api/familyspaces/[id] - Get familyspace details
  GET: async (req, res) => {
    const user = await getAuthUser(req, res)
    const familyspaceId = req.query.id as string

    await requireFamilyspaceRole(user.id, familyspaceId, 'VIEWER')

    const familyspace = await prisma.familyspace.findUnique({
      where: { id: familyspaceId },
      include: {
        owner: {
          select: { id: true, email: true, displayName: true, avatarUrl: true },
        },
        subscription: {
          include: { plan: true },
        },
        avatarAsset: { select: { id: true } },
        _count: {
          select: {
            members: true,
            people: true,
            stories: true,
            voiceProfiles: true,
            assets: true,
            documents: true,
          },
        },
      },
    })

    if (!familyspace) {
      throw Errors.notFound('Familyspace')
    }

    return successResponse(res, {
      id: familyspace.id,
      name: familyspace.name,
      slug: familyspace.slug,
      planType: familyspace.planType,
      deploymentMode: familyspace.deploymentMode,
      tunnelEnabled: familyspace.tunnelEnabled,
      cloudGpuEnabled: familyspace.cloudGpuEnabled,
      isPublic: familyspace.isPublic,
      allowMemberStories: familyspace.allowMemberStories,
      deletionVotes: familyspace.deletionVotes,
      avatarAssetId: familyspace.avatarAsset?.id ?? null,
      owner: familyspace.owner,
      subscription: familyspace.subscription
        ? {
            planName: familyspace.subscription.plan.name,
            billingStatus: familyspace.subscription.billingStatus,
            renewalDate: familyspace.subscription.renewalDate,
          }
        : null,
      counts: familyspace._count,
      createdAt: familyspace.createdAt,
    })
  },

  // PUT /api/familyspaces/[id] - Update familyspace
  PUT: {
    schema: updateFamilyspaceSchema,
    handler: async (req, res) => {
      const user = await getAuthUser(req, res)
      const familyspaceId = req.query.id as string

      await requireFamilyspaceRole(user.id, familyspaceId, 'ADMIN')

      const familyspace = await prisma.familyspace.update({
        where: { id: familyspaceId },
        data: req.body,
        select: {
          id: true,
          name: true,
          slug: true,
          planType: true,
          isPublic: true,
          allowMemberStories: true,
          avatarAssetId: true,
          updatedAt: true,
        },
      })

      return successResponse(res, familyspace)
    },
  },

  // DELETE /api/familyspaces/[id] - Delete familyspace
  DELETE: async (req, res) => {
    const user = await getAuthUser(req, res)
    const familyspaceId = req.query.id as string

    // For simplicity, we'll implement the "Vote to delete" logic here or in a separate endpoint
    // The requirement says "requires vote from all members"
    await requireFamilyspaceRole(user.id, familyspaceId, 'VIEWER')

    const familyspace = await prisma.familyspace.findUnique({
      where: { id: familyspaceId },
      include: {
        members: {
          where: { status: 'ACTIVE' },
          select: { userId: true },
        },
      },
    })

    if (!familyspace) throw Errors.notFound('Familyspace')

    const activeMemberIds = familyspace.members.map((m) => m.userId)
    const currentVotes = (familyspace.deletionVotes as Record<string, boolean>) || {}

    // Add current user's vote
    currentVotes[user.id] = true

    // Check if all active members have voted
    const hasAllVotes = activeMemberIds.every((id) => currentVotes[id])

    if (hasAllVotes) {
      // Prevent deleting the user's only familyspace
      const membershipCount = await prisma.membership.count({
        where: { userId: user.id, status: 'ACTIVE' },
      })

      if (membershipCount <= 1) {
        throw Errors.badRequest('Cannot delete your only familyspace')
      }

      await prisma.familyspace.delete({
        where: { id: familyspaceId },
      })

      return successResponse(res, { deleted: true })
    } else {
      // Just record the vote
      await prisma.familyspace.update({
        where: { id: familyspaceId },
        data: { deletionVotes: currentVotes },
      })

      return successResponse(res, {
        deleted: false,
        votesNeeded: activeMemberIds.length,
        votesReceived: Object.keys(currentVotes).length,
      })
    }
  },
})
