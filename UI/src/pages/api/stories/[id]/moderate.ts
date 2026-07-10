import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { storyService } from '@/services'
import { validate, rules } from '@/lib/validation'

export default apiHandler({
  // POST /api/stories/[id]/moderate - approve or reject a public submission.
  // Requires at least one family member (EDITOR+) to approve before a
  // publicly-submitted story is published (see docs/sharing.md).
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const storyId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const { action } = req.body ?? {}
    const { valid, errors } = validate(req.body ?? {}, {
      action: [rules.required, rules.oneOf(['approve', 'reject'])],
    })
    if (!valid) {
      throw Errors.badRequest('Validation failed', errors)
    }

    await storyService.moderateSubmission(storyId, user.familyspaceId, user.id, action)
    return successResponse(res, { action })
  },
})
