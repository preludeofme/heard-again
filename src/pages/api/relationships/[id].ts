import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // DELETE /api/relationships/[id] - Remove a relationship
  DELETE: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const relationshipId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const relationship = await prisma.personRelationship.findFirst({
      where: { id: relationshipId },
      include: {
        sourcePerson: { select: { workspaceId: true } },
      },
    })

    if (!relationship) throw Errors.notFound('Relationship')
    if (relationship.sourcePerson.workspaceId !== user.workspaceId) {
      throw Errors.forbidden()
    }

    await prisma.personRelationship.delete({ where: { id: relationshipId } })

    return successResponse(res, { deleted: true })
  },
})
