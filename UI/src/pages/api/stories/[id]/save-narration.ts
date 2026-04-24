import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors, errorResponse, AppError } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { withCSRFProtection } from '@/lib/security/csrf'
import { voiceService } from '@/services'
import { logger } from '@/lib/logger'

export default apiHandler({
  POST: withCSRFProtection(async (req, res) => {
    if (process.env.AUDIO_GENERATION_ENABLED !== 'true') {
      return res.status(503).json({ success: false, error: 'Audio generation is not yet available' })
    }

    const user = await getAuthUserWithWorkspace(req, res)
    const storyId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const { voiceProfileId, language = 'en' } = req.body ?? {}

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

    // Resolve voice profile.
    let profileId: string | null = voiceProfileId || story.voiceProfileId || null
    if (!profileId && story.subjectId) {
      const defaultProfile = await prisma.voiceProfile.findFirst({
        where: {
          workspaceId: user.workspaceId,
          personId: story.subjectId,
          isDefault: true,
          status: 'READY',
        },
        select: { id: true },
      })
      profileId = defaultProfile?.id ?? null
    }
    if (!profileId) {
      throw Errors.badRequest('No voice profile specified or available for this story')
    }

    try {
      const synthesis = await voiceService.synthesize({
        workspaceId: user.workspaceId,
        userId: user.id,
        modelId: profileId,
        text,
        language,
        authToken: '',
      })

      // Link the generated asset to the story and store the voice profile used.
      await prisma.story.update({
        where: { id: story.id },
        data: {
          generatedAudioAssetId: synthesis.outputAssetId,
          voiceProfileId: synthesis.voiceProfileId,
        },
      })

      // Attach the storyId to the job row (voiceService doesn't know about the story).
      await prisma.voiceGenerationJob.update({
        where: { id: synthesis.jobId },
        data: { storyId: story.id },
      })

      return successResponse(res, {
        jobId: synthesis.jobId,
        outputAssetId: synthesis.outputAssetId,
        outputAssetDownloadUrl: synthesis.outputAssetDownloadUrl,
        audioUrl: synthesis.audioUrl,
        voiceProfileId: synthesis.voiceProfileId,
        duration: synthesis.duration,
      })
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(res, error.message, error.statusCode, error.code)
      }
      logger.error('[save-narration] synthesis failed', { storyId, error })
      const message = error instanceof Error ? error.message : 'Save narration failed'
      return errorResponse(res, message, 503, 'SAVE_NARRATION_FAILED')
    }
  }),
})
