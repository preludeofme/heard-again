import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { personService } from '@/services'
import { updatePersonSchema } from '@/schemas'

export default apiHandler({
  // GET /api/people/[id] - Get person details
  GET: async (req, res) => {
    const personId = req.query.id as string
    
    let user = null
    try {
      user = await getAuthUserWithFamilyspace(req, res)
    } catch (e) {
      // Not authenticated
    }

    let result
    try {
      result = await personService.getPersonDetail(personId, user?.familyspaceId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get person details'
      return res.status(500).json({ success: false, error: message })
    }

    if (!result) {
      throw Errors.notFound('Person')
    }

    // If not authenticated, return only basic info
    if (!user) {
      return successResponse(res, {
        id: result.id,
        firstName: result.firstName,
        middleName: result.middleName,
        lastName: result.lastName,
        displayName: result.displayName,
        avatarUrl: result.avatarUrl,
      })
    }

    return successResponse(res, result)
  },

  // PUT /api/people/[id] - Update person
  PUT: {
    schema: updatePersonSchema,
    handler: async (req, res) => {
      const user = await getAuthUserWithFamilyspace(req, res)
      const personId = req.query.id as string
      await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

      const result = await personService.updatePerson(personId, user.familyspaceId, req.body, user.id)
      return successResponse(res, result)
    }
  },

  // DELETE /api/people/[id] - Delete person
  DELETE: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const personId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'ADMIN')

    await personService.deletePerson(personId, user.familyspaceId, user.id)
    return successResponse(res, { deleted: true })
  },
})
