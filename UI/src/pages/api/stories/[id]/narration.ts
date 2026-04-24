import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { withCSRFProtection } from '@/lib/security/csrf'
import type { NarrationStatus } from '@prisma/client'

const MAX_NARRATION_CHARS = 20000

const ALLOWED_ACTIONS = new Set(['update', 'approve', 'discard'])

export default apiHandler({
  // PATCH /api/stories/[id]/narration
  // body: { action: 'update' | 'approve' | 'discard', narratedContent?: string }
  PATCH: withCSRFProtection(async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const storyId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const { action, narratedContent } = req.body ?? {}

    if (typeof action !== 'string' || !ALLOWED_ACTIONS.has(action)) {
      throw Errors.badRequest('Invalid action (must be update, approve, or discard)')
    }

    const story = await prisma.story.findFirst({
      where: { id: storyId, workspaceId: user.workspaceId },
      select: { id: true, narratedContent: true, narrationStatus: true },
    })
    if (!story) throw Errors.notFound('Story')

    const data: Record<string, unknown> = {
      narrationUpdatedAt: new Date(),
    }

    if (action === 'discard') {
      data.narratedContent = null
      data.narrationStatus = 'NONE' satisfies NarrationStatus
      data.narrationModel = null
      data.narrationApprovedAt = null
      data.narrationApprovedById = null
    } else {
      // update or approve
      if (narratedContent !== undefined) {
        if (typeof narratedContent !== 'string') {
          throw Errors.badRequest('narratedContent must be a string')
        }
        const trimmed = narratedContent.trim()
        if (trimmed.length === 0) {
          throw Errors.badRequest('narratedContent cannot be empty')
        }
        if (trimmed.length > MAX_NARRATION_CHARS) {
          throw Errors.badRequest(
            `narratedContent exceeds ${MAX_NARRATION_CHARS} character limit`
          )
        }
        data.narratedContent = trimmed
      } else if (!story.narratedContent) {
        throw Errors.badRequest('No narration content to operate on')
      }

      if (action === 'approve') {
        data.narrationStatus = 'APPROVED' satisfies NarrationStatus
        data.narrationApprovedAt = new Date()
        data.narrationApprovedById = user.id
      } else {
        // action === 'update' — remain in READY so the user knows they still need to approve
        data.narrationStatus = 'READY' satisfies NarrationStatus
        data.narrationApprovedAt = null
        data.narrationApprovedById = null
      }
    }

    const updated = await prisma.story.update({
      where: { id: storyId },
      data,
      select: {
        id: true,
        narratedContent: true,
        narrationStatus: true,
        narrationModel: true,
        narrationUpdatedAt: true,
        narrationApprovedAt: true,
      },
    })

    return successResponse(res, updated)
  }),
})
