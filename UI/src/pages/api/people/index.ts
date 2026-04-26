import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { personService } from '@/services'
import { createPersonSchema, listPeopleQuerySchema, validateQuery, formatZodError } from '@/schemas'

export default apiHandler({
  // GET /api/people - List people in workspace
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    
    // Validate query parameters (not handled by apiHandler's body schema)
    const queryValidation = validateQuery(listPeopleQuerySchema, req.query)
    if (!queryValidation.success) {
      throw Errors.badRequest('Invalid query parameters', formatZodError(queryValidation.details))
    }

    const result = await personService.listPeople(user.workspaceId, queryValidation.data)
    return successResponse(res, result)
  },

  // POST /api/people - Create a person
  POST: {
    schema: createPersonSchema,
    handler: async (req, res) => {
      const user = await getAuthUserWithWorkspace(req, res)
      await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

      // req.body is already validated and typed by apiHandler
      const result = await personService.createPerson(user.workspaceId, user.id, req.body)
      return successResponse(res, result, 201)
    }
  },
})
