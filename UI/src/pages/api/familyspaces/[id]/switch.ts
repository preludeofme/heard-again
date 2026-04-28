import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUser, requireFamilyspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // POST /api/familyspaces/[id]/switch - Set as default familyspace
  POST: async (req, res) => {
    const user = await getAuthUser(req, res)
    const familyspaceId = req.query.id as string

    await requireFamilyspaceRole(user.id, familyspaceId, 'VIEWER')

    await prisma.user.update({
      where: { id: user.id },
      data: { defaultFamilyspaceId: familyspaceId },
    })

    return successResponse(res, { defaultFamilyspaceId: familyspaceId })
  },
})
