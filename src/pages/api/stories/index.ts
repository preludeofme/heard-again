import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { storyService } from '@/services'
import { validateBody, validateQuery, createStorySchema, listStoriesQuerySchema, formatZodError } from '@/schemas'

export default apiHandler({
  // GET /api/stories - List stories (with filters)
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    
    // Validate query parameters
    const queryValidation = validateQuery(listStoriesQuerySchema, req.query)
    if (!queryValidation.success) {
      throw Errors.badRequest('Invalid query parameters', formatZodError(queryValidation.details))
    }

    const result = await storyService.listStories(user.workspaceId, queryValidation.data)
    return successResponse(res, result)
  },

  // POST /api/stories - Create a story
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    // Validate request body
    const bodyValidation = validateBody(createStorySchema, req.body)
    if (!bodyValidation.success) {
      throw Errors.badRequest('Validation failed', formatZodError(bodyValidation.details))
    }

    const result = await storyService.createStory(user.workspaceId, user.id, bodyValidation.data)
    return successResponse(res, result, 201)
  },
})
