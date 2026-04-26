import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { personService } from '@/services'
import { updatePersonSchema } from '@/schemas'

export default apiHandler({
  // GET /api/people/[id] - Get person details
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const personId = req.query.id as string

    const result = await personService.getPersonDetail(personId, user.workspaceId)

    if (!result) {
      throw Errors.notFound('Person')
    }

    return successResponse(res, result)
  },

  // PUT /api/people/[id] - Update person
  PUT: {
    schema: updatePersonSchema,
    handler: async (req, res) => {
      const user = await getAuthUserWithWorkspace(req, res)
      const personId = req.query.id as string
      await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

      const result = await personService.updatePerson(personId, user.workspaceId, req.body)
      return successResponse(res, result)
    }
  },

  // DELETE /api/people/[id] - Delete person
  DELETE: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const personId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'ADMIN')

    await personService.deletePerson(personId, user.workspaceId)
    return successResponse(res, { deleted: true })
  },
})
