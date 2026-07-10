import { apiHandler, successResponse, Errors, sanitizeStoryResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { storyService } from '@/services'
import { updateStorySchema } from '@/schemas'
import { checkRateLimit } from '@/lib/security/rate-limiter'

export default apiHandler({
  // GET /api/stories/[id] - Get story details
  GET: async (req, res) => {
    const storyId = req.query.id as string

    let user = null
    try {
      user = await getAuthUserWithFamilyspace(req, res)
    } catch (e) {
      // Not authenticated, that's fine — fall through to the share-link check below
    }

    if (!user) {
      // Anonymous access requires a valid, unexpired share token — being
      // marked isPublic alone isn't enough (see docs/sharing.md). Rate-limit
      // this branch the same as the other public sharing endpoints, since
      // it's otherwise unauthenticated and unthrottled.
      const allowed = await checkRateLimit('public', req, res)
      if (!allowed) return

      // Use the dedicated public endpoint so we never leak internal-only fields.
      const publicStory = await storyService.getPublicStory(storyId, req.query.token)
      if (!publicStory) throw Errors.unauthorized()
      return successResponse(res, publicStory)
    }

    const story = await storyService.getStoryDetail(storyId, user.familyspaceId)
    if (!story) throw Errors.notFound('Story')

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

      const result = await storyService.updateStory(storyId, user.familyspaceId, req.body, user.id)
      return successResponse(res, result)
    }
  },

  // DELETE /api/stories/[id] - Delete story
  DELETE: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const storyId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    await storyService.deleteStory(storyId, user.familyspaceId, user.id)
    return successResponse(res, { deleted: true })
  },
})
