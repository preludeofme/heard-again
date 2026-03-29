import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { personService } from '@/services'
import { validateBody, validateQuery, createPersonSchema, listPeopleQuerySchema, formatZodError } from '@/schemas'
import { withCSRFProtection } from '@/lib/security/csrf'

export default apiHandler({
  // GET /api/people - List people in workspace
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    
    // Validate query parameters
    const queryValidation = validateQuery(listPeopleQuerySchema, req.query)
    if (!queryValidation.success) {
      throw Errors.badRequest('Invalid query parameters', formatZodError(queryValidation.details))
    }

    const result = await personService.listPeople(user.workspaceId, queryValidation.data)
    return successResponse(res, result)
  },

  // POST /api/people - Create a person
  POST: withCSRFProtection(async (req, res) => {

    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    // Validate request body
    const bodyValidation = validateBody(createPersonSchema, req.body)
    if (!bodyValidation.success) {
      throw Errors.badRequest('Validation failed', formatZodError(bodyValidation.details))
    }

    const result = await personService.createPerson(user.workspaceId, user.id, bodyValidation.data)
    return successResponse(res, result, 201)
  }),
})
