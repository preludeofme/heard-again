import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // POST /api/stories/[id]/generate-audio - Generate TTS audio for a story
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const storyId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const story = await prisma.story.findFirst({
      where: { id: storyId, workspaceId: user.workspaceId },
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
          workspaceId: user.workspaceId,
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
