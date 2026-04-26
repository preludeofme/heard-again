import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { enqueueNarrationRender } from '@/lib/queues/narrationQueue'
import { logger } from '@/lib/logger'
import type { NarrationStatus } from '@prisma/client'

const MAX_NARRATION_CHARS = 20000

const ALLOWED_ACTIONS = new Set(['update', 'approve', 'discard'])

async function enqueueRenderOnApprove(params: {
  storyId: string
  workspaceId: string
  userId: string
}) {
  const { storyId, workspaceId, userId } = params

  const story = await prisma.story.findFirst({
    where: { id: storyId, workspaceId },
    select: { id: true, voiceProfileId: true, subjectId: true },
  })
  if (!story) return null

  let voiceProfileId = story.voiceProfileId
  if (!voiceProfileId && story.subjectId) {
    const defaultProfile = await prisma.voiceProfile.findFirst({
      where: {
        workspaceId,
        personId: story.subjectId,
        isDefault: true,
        status: 'READY',
      },
      select: { id: true },
    })
    voiceProfileId = defaultProfile?.id ?? null
  }
  if (!voiceProfileId) {
    logger.info('[narration.approve] no voice profile — skipping render enqueue', { storyId })
    return null
  }

  const profile = await prisma.voiceProfile.findFirst({
    where: { id: voiceProfileId, workspaceId, status: 'READY' },
    select: { id: true, personId: true },
  })
  if (!profile) {
    logger.info('[narration.approve] voice profile not READY — skipping render enqueue', { storyId })
    return null
  }

  if (profile.personId) {
    const consent = await prisma.voiceConsent.findFirst({
      where: {
        workspaceId,
        revokedAt: null,
        allowsGeneration: true,
        OR: [{ voiceProfileId: profile.id }, { personId: profile.personId }],
      },
      orderBy: { recordedAt: 'desc' },
    })
    if (!consent) {
      logger.info('[narration.approve] no consent — skipping render enqueue', { storyId })
      return null
    }
  }

  const voiceGenerationJob = await prisma.voiceGenerationJob.create({
    data: {
      voiceProfileId: profile.id,
      storyId,
      text: '(pending render)',
      status: 'QUEUED',
      styleOverride: { source: 'narration.approve' },
    },
    select: { id: true },
  })

  const queueJobId = await enqueueNarrationRender({
    storyId,
    workspaceId,
    voiceProfileId: profile.id,
    userId,
    voiceGenerationJobId: voiceGenerationJob.id,
  })

  await prisma.story.update({
    where: { id: storyId },
    data: { narrationRenderJobId: voiceGenerationJob.id, voiceProfileId: profile.id },
  })

  return { narrationJobId: voiceGenerationJob.id, queueJobId }
}

export default apiHandler({
  // PATCH /api/stories/[id]/narration
  // body: { action: 'update' | 'approve' | 'discard', narratedContent?: string }
  PATCH: async (req, res) => {
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

    let renderEnqueue: { narrationJobId: string; queueJobId: string } | null = null
    if (action === 'approve' && process.env.AUDIO_GENERATION_ENABLED === 'true') {
      try {
        renderEnqueue = await enqueueRenderOnApprove({
          storyId,
          workspaceId: user.workspaceId,
          userId: user.id,
        })
      } catch (err) {
        logger.error('[narration] approve-enqueue failed (non-fatal)', { storyId, err })
      }
    }

    return successResponse(res, {
      ...updated,
      narrationJobId: renderEnqueue?.narrationJobId ?? null,
      queueJobId: renderEnqueue?.queueJobId ?? null,
    })
  },
})
