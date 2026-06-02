import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { checkQuota } from '@/lib/entitlements'
export default apiHandler({
  // POST /api/stories/[id]/generate-audio - Generate TTS audio for a story
  POST: async (req, res) => {
    if (process.env.AUDIO_GENERATION_ENABLED !== 'true') {
      return res.status(503).json({ success: false, error: 'Audio generation is not yet available' })
    }

    const user = await getAuthUserWithFamilyspace(req, res)
    const storyId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    // Check generation quota before allowing the job
    const quota = await checkQuota(user.familyspaceId, 'generation')
    if (!quota.allowed) {
      return res.status(402).json({
        success: false,
        error: quota.reason,
        code: 'QUOTA_EXCEEDED',
        upgradeUrl: quota.upgradeUrl,
      })
    }

    const story = await prisma.story.findFirst({
      where: { id: storyId, familyspaceId: user.familyspaceId },
    })
    if (!story) throw Errors.notFound('Story')

    const { voiceProfileId, text } = req.body

    // Use provided text or story content
    const speechText = text || story.content
    if (!speechText) throw Errors.badRequest('No text content to generate audio from')

    // Resolve voice profile
    let profileId = voiceProfileId
    if (!profileId && story.subjectId) {
      // Try to find a default voice profile for the subject
      const defaultProfile = await prisma.voiceProfile.findFirst({
        where: {
          familyspaceId: user.familyspaceId,
          personId: story.subjectId,
          isDefault: true,
          status: 'READY',
        },
      })
      profileId = defaultProfile?.id
    }

    if (!profileId) {
      throw Errors.badRequest('No voice profile specified and no default profile found for story subject')
    }

    // Create a generation job record
    const job = await prisma.voiceGenerationJob.create({
      data: {
        voiceProfileId: profileId,
        storyId,
        text: speechText.substring(0, 10000),
        status: 'QUEUED',
      },
    })

    // TODO: In production, this would dispatch to a queue that calls the TTS service
    // For now, return the job ID for polling
    return successResponse(res, {
      jobId: job.id,
      status: job.status,
      voiceProfileId: profileId,
      textLength: speechText.length,
    }, 201)
  },
})
