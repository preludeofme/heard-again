import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { storyService } from '@/services'
import { createStorySchema, listStoriesQuerySchema, validateQuery } from '@/schemas'
import { prisma } from '@/lib/prisma'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default apiHandler({
  // GET /api/stories - List stories (with filters)
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    
    // Validate query parameters
    const queryValidation = validateQuery(listStoriesQuerySchema, req.query)
    if (!queryValidation.success) {
      throw Errors.badRequest('Invalid query parameters', formatZodError(queryValidation.details))
    }

    const result = await storyService.listStories(user.familyspaceId, queryValidation.data)
    return successResponse(res, result)
  },

  // POST /api/stories - Create a new story
  POST: {
    schema: createStorySchema,
    handler: async (req, res) => {
      let user = null
      try {
        user = await getAuthUserWithFamilyspace(req, res)
      } catch (e) {
        // Not authenticated, check if subjectId is provided for public contribution
      }

      const { subjectId } = req.body
      let familyspaceId = user?.familyspaceId

      if (!user) {
        if (!subjectId) {
          throw Errors.unauthorized()
        }
        // Look up the familyspaceId from the subject
        const person = await prisma.person.findUnique({
          where: { id: subjectId },
          select: { familyspaceId: true },
        })
        if (!person) throw Errors.notFound('Subject')
        familyspaceId = person.familyspaceId
      }

      // If authenticated, we require EDITOR role
      if (user) {
        await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')
      }

      // If not authenticated, we use a null userId or a special system ID
      // The service needs to handle null userId for public contributions
      const result = await storyService.createStory(familyspaceId, user?.id || null, req.body)
      return successResponse(res, result, 201)
    }
  },
})
