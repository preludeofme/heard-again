import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors, AppError } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { enqueueNarrationRender } from '@/lib/queues/narrationQueue'
import { logger } from '@/lib/logger'

export default apiHandler({
  POST: async (req, res) => {
    if (process.env.AUDIO_GENERATION_ENABLED !== 'true') {
      return res.status(503).json({ success: false, error: 'Audio generation is not yet available' })
    }

    const user = await getAuthUserWithWorkspace(req, res)
    const storyId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const { voiceProfileId: bodyVoiceProfileId } = req.body ?? {}

    const story = await prisma.story.findFirst({
      where: { id: storyId, workspaceId: user.workspaceId },
      select: {
        id: true,
        content: true,
        narratedContent: true,
        narrationStatus: true,
        voiceProfileId: true,
        subjectId: true,
      },
    })
    if (!story) throw Errors.notFound('Story')

    const text =
      story.narrationStatus === 'APPROVED' && story.narratedContent
        ? story.narratedContent
        : story.content
    if (!text || text.trim().length === 0) {
      throw Errors.badRequest('Story has no text to narrate')
    }

    let voiceProfileId: string | null = bodyVoiceProfileId || story.voiceProfileId || null
    if (!voiceProfileId && story.subjectId) {
      const defaultProfile = await prisma.voiceProfile.findFirst({
        where: {
          workspaceId: user.workspaceId,
          personId: story.subjectId,
          isDefault: true,
          status: 'READY',
        },
        select: { id: true },
      })
      voiceProfileId = defaultProfile?.id ?? null
    }
    if (!voiceProfileId) {
      throw Errors.badRequest('No voice profile specified or available for this story')
    }

    const profile = await prisma.voiceProfile.findFirst({
      where: { id: voiceProfileId, workspaceId: user.workspaceId, status: 'READY' },
      select: { id: true, personId: true },
    })
    if (!profile) {
      throw Errors.notFound('Voice profile')
    }

    if (profile.personId) {
      const consent = await prisma.voiceConsent.findFirst({
        where: {
          workspaceId: user.workspaceId,
          revokedAt: null,
          allowsGeneration: true,
          OR: [{ voiceProfileId: profile.id }, { personId: profile.personId }],
        },
        orderBy: { recordedAt: 'desc' },
      })
      if (!consent) {
        throw Errors.forbidden(
          'Voice generation is blocked until explicit consent is recorded'
        )
      }
    }

    // Per-(story, voiceProfileId) cache: if we already have a completed render
    // for this exact pair, short-circuit instead of re-enqueueing.
    const cachedAsset = await prisma.asset.findFirst({
      where: {
        workspaceId: user.workspaceId,
        assetType: 'GENERATED_AUDIO',
        processingStatus: 'COMPLETED',
        AND: [
          { metadata: { path: ['storyId'], equals: storyId } },
          { metadata: { path: ['voiceProfileId'], equals: profile.id } },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    })
    if (cachedAsset) {
      return successResponse(res, {
        alreadyRendered: true,
        outputAssetId: cachedAsset.id,
        outputAssetDownloadUrl: `/api/assets/${cachedAsset.id}/download`,
        voiceProfileId: profile.id,
      })
    }

    try {
      const voiceGenerationJob = await prisma.voiceGenerationJob.create({
        data: {
          voiceProfileId: profile.id,
          storyId,
          text: text.substring(0, 10000),
          status: 'QUEUED',
          styleOverride: { source: 'save-narration' },
        },
        select: { id: true },
      })

      const queueJobId = await enqueueNarrationRender({
        storyId,
        workspaceId: user.workspaceId,
        voiceProfileId: profile.id,
        userId: user.id,
        voiceGenerationJobId: voiceGenerationJob.id,
      })

      await prisma.story.update({
        where: { id: storyId },
        data: { narrationRenderJobId: voiceGenerationJob.id },
      })

      return successResponse(res, {
        queued: true,
        narrationJobId: voiceGenerationJob.id,
        queueJobId,
        voiceProfileId: profile.id,
      })
    } catch (error) {
      logger.error('[save-narration] enqueue failed', { storyId, error })
      throw new AppError('Failed to queue narration render', 503, 'ENQUEUE_FAILED')
    }
  },
})
