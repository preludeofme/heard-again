import { logger } from '@/lib/logger'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'
import { relationshipService } from '@/services'
import { AppError } from '@/lib/api-helpers'
import { Prisma } from '@prisma/client'
export default apiHandler({
  // GET /api/people/[id]/relationships - Get person's relationships
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const personId = req.query.id as string

    const relationships = await relationshipService.getRelationships(
      user.familyspaceId,
      personId
    )

    return successResponse(res, relationships)
  },

  // POST /api/people/[id]/relationships - Create a relationship
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const personId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const { valid, errors } = validate(req.body, {
      targetPersonId: [rules.required, rules.uuid],
      relationshipType: [rules.required, rules.oneOf(['PARENT', 'CHILD', 'SPOUSE'])],
      relationshipKind: [rules.oneOf(['BIOLOGICAL', 'ADOPTED', 'STEP', 'FOSTER', 'GUARDIAN'])],
      isBiological: [rules.boolean],
      marriageDate: [rules.date],
      marriagePlace: [rules.string],
    })

    if (!valid) throw Errors.badRequest('Validation failed', errors)

    const {
      targetPersonId,
      relationshipType,
      relationshipKind,
      isBiological = true,
      notes,
      marriageDate,
      marriagePlace,
    } = req.body

    logger.info('Creating relationship:', {
      familyspaceId: user.familyspaceId,
      sourcePersonId: personId,
      targetPersonId,
      relationshipType,
      relationshipKind,
      isBiological,
      notes,
      marriageDate,
      marriagePlace,
    })

    try {
      const result = await relationshipService.createRelationship({
        familyspaceId: user.familyspaceId,
        sourcePersonId: personId,
        targetPersonId,
        relationshipType,
        relationshipKind,
        isBiological,
        notes,
        marriageDate,
        marriagePlace,
      })

      logger.info('Relationship created successfully:', result)
      return successResponse(res, result, 201)
    } catch (error) {
      logger.error('Relationship creation failed:', error)
      if (error instanceof AppError) {
        throw error
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw Errors.badRequest(error.message, {
          prismaCode: error.code,
          meta: error.meta,
        })
      }
      if (error instanceof Error) {
        throw Errors.internal(error.message)
      }
      throw Errors.internal('Failed to create relationship')
    }
  },
})
