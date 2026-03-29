import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUser, requireWorkspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'
import { v4 as uuidv4 } from 'uuid'

export default apiHandler({
  // POST /api/workspaces/[id]/invite - Invite a member
  POST: async (req, res) => {
    const user = await getAuthUser(req, res)
    const workspaceId = req.query.id as string

    await requireWorkspaceRole(user.id, workspaceId, 'ADMIN')

    const { valid, errors } = validate(req.body, {
      email: [rules.required, rules.email],
      role: [rules.oneOf(['VIEWER', 'LEGACY', 'EDITOR', 'ADMIN'])],
    })

    if (!valid) {
      throw Errors.badRequest('Validation failed', errors)
    }

    const { email, role = 'VIEWER' } = req.body

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      const existingMembership = await prisma.membership.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
      })
      if (existingMembership && existingMembership.status === 'ACTIVE') {
        throw Errors.conflict('User is already a member of this workspace')
      }
    }

    // Check for existing pending invite
    const existingInvite = await prisma.workspaceInvite.findFirst({
      where: { workspaceId, email, status: 'PENDING' },
    })
    if (existingInvite) {
      throw Errors.conflict('An invite is already pending for this email')
    }

    const token = uuidv4()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId,
        email,
        role,
        invitedById: user.id,
        token,
        expiresAt,
      },
    })

    return successResponse(res, {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      token: invite.token,
      expiresAt: invite.expiresAt,
    }, 201)
  },

  // GET /api/workspaces/[id]/invite - List workspace invites
  GET: async (req, res) => {
    const user = await getAuthUser(req, res)
    const workspaceId = req.query.id as string

    await requireWorkspaceRole(user.id, workspaceId, 'ADMIN')

    const invites = await prisma.workspaceInvite.findMany({
      where: { workspaceId },
      include: {
        invitedBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(res, invites)
  },
})
