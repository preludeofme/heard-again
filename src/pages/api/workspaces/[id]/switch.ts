import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUser, requireWorkspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // POST /api/workspaces/[id]/switch - Set as default workspace
  POST: async (req, res) => {
    const user = await getAuthUser(req, res)
    const workspaceId = req.query.id as string

    await requireWorkspaceRole(user.id, workspaceId, 'VIEWER')

    await prisma.user.update({
      where: { id: user.id },
      data: { defaultWorkspaceId: workspaceId },
    })

    return successResponse(res, { defaultWorkspaceId: workspaceId })
  },
})
