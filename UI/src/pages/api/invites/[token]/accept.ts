import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUser } from '@/lib/auth-helpers'

export default apiHandler({
  // POST /api/invites/[token]/accept - Accept a workspace invite
  POST: async (req, res) => {
    const user = await getAuthUser(req, res)
    const token = req.query.token as string

    const invite = await prisma.workspaceInvite.findUnique({
      where: { token },
      include: { workspace: { select: { id: true, name: true } } },
    })

    if (!invite) throw Errors.notFound('Invite')

    if (invite.status !== 'PENDING') {
      throw Errors.badRequest(`Invite has already been ${invite.status.toLowerCase()}`)
    }

    if (new Date() > invite.expiresAt) {
      await prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      })
      throw Errors.badRequest('Invite has expired')
    }

    if (invite.email !== user.email) {
      throw Errors.forbidden('This invite was sent to a different email address')
    }

    // Check if already a member
    const existingMembership = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
    })

    if (existingMembership && existingMembership.status === 'ACTIVE') {
      await prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      })
      return successResponse(res, { message: 'Already a member', workspaceId: invite.workspaceId })
    }

    // Create membership and update invite in a transaction
    await prisma.$transaction(async (tx) => {
      if (existingMembership) {
        await tx.membership.update({
          where: { id: existingMembership.id },
          data: { status: 'ACTIVE', role: invite.role },
        })
      } else {
        await tx.membership.create({
          data: {
            workspaceId: invite.workspaceId,
            userId: user.id,
            role: invite.role,
            status: 'ACTIVE',
          },
        })
      }

      await tx.workspaceInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      })
    })

    return successResponse(res, {
      message: 'Invite accepted',
      workspaceId: invite.workspaceId,
      workspaceName: invite.workspace.name,
      role: invite.role,
    })
  },
})
