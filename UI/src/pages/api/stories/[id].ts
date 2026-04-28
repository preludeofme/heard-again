import { apiHandler, successResponse, Errors, sanitizeStoryResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { storyService } from '@/services'
import { updateStorySchema } from '@/schemas'

export default apiHandler({
  // GET /api/stories/[id] - Get story details
  GET: async (req, res) => {
    const storyId = req.query.id as string
    
    // First, try to get the story without requiring auth to check if it's public
    // We pass null for familyspaceId to the service if we don't have a user yet
    // The service might need adjustment to handle this or we use the repo directly
    
    let user = null
    try {
      user = await getAuthUserWithFamilyspace(req, res)
    } catch (e) {
      // Not authenticated, that's fine for now
    }

    const story = await storyService.getStoryDetail(storyId, user?.familyspaceId)
    if (!story) throw Errors.notFound('Story')

    // If not public and no user, throw unauthorized
    if (!story.isPublic && !user) {
      throw Errors.unauthorized()
    }

    // Sanitize response to remove storage path information
    const sanitizedStory = sanitizeStoryResponse(story)

    return successResponse(res, sanitizedStory)
  },

  // PUT /api/stories/[id] - Update story
  PUT: {
    schema: updateStorySchema,
    handler: async (req, res) => {
      const user = await getAuthUserWithFamilyspace(req, res)
      const storyId = req.query.id as string
      await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

      const result = await storyService.updateStory(storyId, user.familyspaceId, req.body)
      return successResponse(res, result)
    }
  },

  // DELETE /api/stories/[id] - Delete story
  DELETE: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const storyId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    await storyService.deleteStory(storyId, user.familyspaceId)
    return successResponse(res, { deleted: true })
  },
})
