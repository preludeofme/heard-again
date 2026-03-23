import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // DELETE /api/relationships/[id] - Remove a relationship
  DELETE: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const relationshipId = decodeURIComponent(req.query.id as string)
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    if (relationshipId.startsWith('fam:')) {
      const parts = relationshipId.split(':')
      const familyId = parts[1]

      const family = await prisma.familyUnit.findFirst({
        where: { id: familyId, workspaceId: user.workspaceId },
      })
      if (!family) throw Errors.notFound('Relationship')

      await prisma.familyUnit.delete({ where: { id: familyId } })
      return successResponse(res, { deleted: true })
    }

    if (relationshipId.startsWith('fc:')) {
      const parts = relationshipId.split(':')
      const familyId = parts[1]
      const childId = parts[2]

      const family = await prisma.familyUnit.findFirst({
        where: { id: familyId, workspaceId: user.workspaceId },
      })
      if (!family) throw Errors.notFound('Relationship')

      const deleteResult = await prisma.familyChild.deleteMany({
        where: {
          familyId,
          childId,
        },
      })

      if (deleteResult.count === 0) {
        throw Errors.notFound('Relationship')
      }

      return successResponse(res, { deleted: true })
    }

    throw Errors.badRequest('Unsupported relationship identifier')

  },
})
