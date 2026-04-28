import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUser, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'

export default apiHandler({
  // PUT /api/familyspaces/[id]/members/[userId] - Update member role
  PUT: async (req, res) => {
    const user = await getAuthUser(req, res)
    const familyspaceId = req.query.id as string
    const targetUserId = req.query.userId as string

    await requireFamilyspaceRole(user.id, familyspaceId, 'ADMIN')

    const { valid, errors } = validate(req.body, {
      role: [rules.required, rules.oneOf(['VIEWER', 'LEGACY', 'EDITOR', 'ADMIN'])],
    })
    if (!valid) throw Errors.badRequest('Validation failed', errors)

    const { role } = req.body

    // Cannot change owner role
    const membership = await prisma.membership.findUnique({
      where: { familyspaceId_userId: { familyspaceId, userId: targetUserId } },
    })
    if (!membership) throw Errors.notFound('Membership')
    if (membership.role === 'OWNER') {
      throw Errors.badRequest('Cannot change the familyspace owner role')
    }

    // Cannot promote to OWNER
    if (role === 'OWNER') {
      throw Errors.badRequest('Cannot promote to OWNER via this endpoint')
    }

    const updated = await prisma.membership.update({
      where: { id: membership.id },
      data: { role },
    })

    return successResponse(res, { id: updated.id, role: updated.role })
  },

  // DELETE /api/familyspaces/[id]/members/[userId] - Remove member
  DELETE: async (req, res) => {
    const user = await getAuthUser(req, res)
    const familyspaceId = req.query.id as string
    const targetUserId = req.query.userId as string

    await requireFamilyspaceRole(user.id, familyspaceId, 'ADMIN')

    const membership = await prisma.membership.findUnique({
      where: { familyspaceId_userId: { familyspaceId, userId: targetUserId } },
    })
    if (!membership) throw Errors.notFound('Membership')
    if (membership.role === 'OWNER') {
      throw Errors.badRequest('Cannot remove the familyspace owner')
    }

    await prisma.membership.update({
      where: { id: membership.id },
      data: { status: 'REMOVED' },
    })

    // If user's default familyspace was this one, clear it
    if (targetUserId !== user.id) {
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { defaultFamilyspaceId: true },
      })
      if (targetUser?.defaultFamilyspaceId === familyspaceId) {
        await prisma.user.update({
          where: { id: targetUserId },
          data: { defaultFamilyspaceId: null },
        })
      }
    }

    return successResponse(res, { removed: true })
  },
})
