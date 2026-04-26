import { apiHandler, successResponse, Errors, sanitizeStoryResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { storyService } from '@/services'
import { updateStorySchema } from '@/schemas'

export default apiHandler({
  // GET /api/stories/[id] - Get story details
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const storyId = req.query.id as string

    const result = await storyService.getStoryDetail(storyId, user.workspaceId)

    if (!result) throw Errors.notFound('Story')

    // Sanitize response to remove storage path information
    const sanitizedStory = sanitizeStoryResponse(result)

    return successResponse(res, sanitizedStory)
  },

  // PUT /api/stories/[id] - Update story
  PUT: {
    schema: updateStorySchema,
    handler: async (req, res) => {
      const user = await getAuthUserWithWorkspace(req, res)
      const storyId = req.query.id as string
      await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

      const result = await storyService.updateStory(storyId, user.workspaceId, req.body)
      return successResponse(res, result)
    }
  },

  // DELETE /api/stories/[id] - Delete story
  DELETE: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const storyId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    await storyService.deleteStory(storyId, user.workspaceId)
    return successResponse(res, { deleted: true })
  },
})
