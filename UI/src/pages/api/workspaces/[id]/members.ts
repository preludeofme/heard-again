import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUser, requireWorkspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/workspaces/[id]/members - List workspace members
  GET: async (req, res) => {
    const user = await getAuthUser(req, res)
    const workspaceId = req.query.id as string

    await requireWorkspaceRole(user.id, workspaceId, 'VIEWER')

    const members = await prisma.membership.findMany({
      where: { workspaceId, status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    })

    const result = members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      email: m.user.email,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      joinedAt: m.joinedAt,
      lastLoginAt: m.user.lastLoginAt,
    }))

    return successResponse(res, result)
  },
})
