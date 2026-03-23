import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'
import { relationshipService } from '@/services'
import { AppError } from '@/lib/api-helpers'

export default apiHandler({
  // GET /api/people/[id]/relationships - Get person's relationships
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const personId = req.query.id as string

    const relationships = await relationshipService.getRelationships(
      user.workspaceId,
      personId
    )

    return successResponse(res, relationships)
  },

  // POST /api/people/[id]/relationships - Create a relationship
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const personId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const { valid, errors } = validate(req.body, {
      targetPersonId: [rules.required, rules.uuid],
      relationshipType: [rules.required, rules.oneOf(['PARENT', 'CHILD', 'SPOUSE'])],
    })

    if (!valid) throw Errors.badRequest('Validation failed', errors)

    const { targetPersonId, relationshipType, isBiological = true, notes } = req.body

    try {
      const result = await relationshipService.createRelationship({
        workspaceId: user.workspaceId,
        sourcePersonId: personId,
        targetPersonId,
        relationshipType,
        isBiological,
        notes,
      })

      return successResponse(res, result, 201)
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      throw Errors.internal('Failed to create relationship')
    }
  },
})
