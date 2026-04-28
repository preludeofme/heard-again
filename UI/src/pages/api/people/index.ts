import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { personService } from '@/services'
import { createPersonSchema, listPeopleQuerySchema, validateQuery, formatZodError } from '@/schemas'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
}

export default apiHandler({
  // GET /api/people - List people in familyspace
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    
    // Validate query parameters (not handled by apiHandler's body schema)
    const queryValidation = validateQuery(listPeopleQuerySchema, req.query)
    if (!queryValidation.success) {
      throw Errors.badRequest('Invalid query parameters', formatZodError(queryValidation.details))
    }

    const result = await personService.listPeople(user.familyspaceId, queryValidation.data)
    return successResponse(res, result)
  },

  // POST /api/people - Create a person
  POST: {
    schema: createPersonSchema,
    handler: async (req, res) => {
      const user = await getAuthUserWithFamilyspace(req, res)
      await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

      // req.body is already validated and typed by apiHandler
      const result = await personService.createPerson(user.familyspaceId, user.id, req.body)
      return successResponse(res, result, 201)
    }
  },
})
