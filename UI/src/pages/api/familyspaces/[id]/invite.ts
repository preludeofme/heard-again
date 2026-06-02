import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUser, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'
import { v4 as uuidv4 } from 'uuid'
import { EmailService } from '@/services/EmailService'
import { checkQuota } from '@/lib/entitlements'

export default apiHandler({
  // POST /api/familyspaces/[id]/invite - Invite a member
  POST: async (req, res) => {
    const user = await getAuthUser(req, res)
    const familyspaceId = req.query.id as string

    await requireFamilyspaceRole(user.id, familyspaceId, 'ADMIN')

    const { valid, errors } = validate(req.body, {
      email: [rules.required, rules.email],
      role: [rules.oneOf(['VIEWER', 'LEGACY', 'EDITOR', 'ADMIN'])],
    })

    if (!valid) {
      throw Errors.badRequest('Validation failed', errors)
    }

    const { email, role = 'VIEWER' } = req.body

    // Get familyspace name for the email
    const familyspace = await prisma.familyspace.findUnique({
      where: { id: familyspaceId },
      select: { name: true }
    })
    if (!familyspace) throw Errors.notFound('Familyspace')

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      const existingMembership = await prisma.membership.findUnique({
        where: { familyspaceId_userId: { familyspaceId, userId: existingUser.id } },
      })
      if (existingMembership && existingMembership.status === 'ACTIVE') {
        throw Errors.conflict('User is already a member of this familyspace')
      }
    }

    // Check member quota before inviting
    const memberQuota = await checkQuota(familyspaceId, 'members')
    if (!memberQuota.allowed) {
      return res.status(402).json({
        success: false,
        error: memberQuota.reason,
        code: 'QUOTA_EXCEEDED',
        upgradeUrl: memberQuota.upgradeUrl,
      })
    }

    // Check for existing pending invite
    const existingInvite = await prisma.familyspaceInvite.findFirst({
      where: { familyspaceId, email, status: 'PENDING' },
    })
    if (existingInvite) {
      throw Errors.conflict('An invite is already pending for this email')
    }

    const token = uuidv4()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const invite = await prisma.familyspaceInvite.create({
      data: {
        familyspaceId,
        email,
        role,
        invitedById: user.id,
        token,
        expiresAt,
      },
    })

    // Send invitation email
    const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`
    await EmailService.sendInviteEmail({
      to: email,
      invitedByName: user.displayName || user.email || 'Someone',
      familyspaceName: familyspace.name,
      inviteToken: token,
      baseUrl
    })

    return successResponse(res, {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      token: invite.token,
      expiresAt: invite.expiresAt,
    }, 201)
  },

  // GET /api/familyspaces/[id]/invite - List familyspace invites
  GET: async (req, res) => {
    const user = await getAuthUser(req, res)
    const familyspaceId = req.query.id as string

    await requireFamilyspaceRole(user.id, familyspaceId, 'ADMIN')

    const invites = await prisma.familyspaceInvite.findMany({
      where: { familyspaceId },
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
