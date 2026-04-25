import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { enqueueNarrationRender } from '@/lib/queues/narrationQueue'

interface CachedNarrationResponse {
  success: true
  status: 'ready'
  assetId: string
  assetDownloadUrl: string
  voiceProfileId: string
}

interface QueuedNarrationResponse {
  success: true
  status: 'queued'
  narrationJobId: string
  queueJobId: string
  voiceProfileId: string
}

function wantsJson(req: NextApiRequest): boolean {
  const accept = (req.headers.accept || '').toLowerCase()
  return accept.includes('application/json')
}

async function findCachedAsset(
  workspaceId: string,
  storyId: string,
  voiceProfileId: string
): Promise<{ id: string } | null> {
  return prisma.asset.findFirst({
    where: {
      workspaceId,
      assetType: 'GENERATED_AUDIO',
      processingStatus: 'COMPLETED',
      AND: [
        { metadata: { path: ['storyId'], equals: storyId } },
        { metadata: { path: ['voiceProfileId'], equals: voiceProfileId } },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD'])
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  if (process.env.AUDIO_GENERATION_ENABLED !== 'true') {
    return res.status(503).json({ success: false, error: 'Audio generation is not yet available' })
  }

  let user
  try {
    user = await getAuthUserWithWorkspace(req, res)
  } catch {
    return
  }

  const storyId = req.query.id as string
  const voiceProfileIdParam = req.query.voiceProfileId as string | undefined

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
  if (!story) {
    return res.status(404).json({ success: false, error: 'Story not found' })
  }

  let profileId = voiceProfileIdParam || story.voiceProfileId || null
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
    return res
      .status(400)
      .json({ success: false, error: 'No voice profile specified or available for this story' })
  }

  const text =
    story.narrationStatus === 'APPROVED' && story.narratedContent
      ? story.narratedContent
      : story.content
  if (!text || text.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Story has no text to narrate' })
  }

  const cachedAsset = await findCachedAsset(user.workspaceId, storyId, profileId)
  if (cachedAsset) {
    res.setHeader('X-Narration-Source', 'cache')
    if (wantsJson(req)) {
      const payload: CachedNarrationResponse = {
        success: true,
        status: 'ready',
        assetId: cachedAsset.id,
        assetDownloadUrl: `/api/assets/${cachedAsset.id}/download`,
        voiceProfileId: profileId,
      }
      return res.status(200).json(payload)
    }
    return res.redirect(302, `/api/assets/${cachedAsset.id}/download`)
  }

  const profile = await prisma.voiceProfile.findFirst({
    where: { id: profileId, workspaceId: user.workspaceId, status: 'READY' },
    select: { id: true, name: true, personId: true },
  })
  if (!profile) {
    return res.status(404).json({ success: false, error: 'Voice profile not found or not ready' })
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
      return res.status(403).json({
        success: false,
        error: 'Voice generation is blocked until explicit consent is recorded',
      })
    }
  }

  try {
    const voiceGenerationJob = await prisma.voiceGenerationJob.create({
      data: {
        voiceProfileId: profile.id,
        storyId,
        text: text.substring(0, 10000),
        status: 'QUEUED',
        styleOverride: { requestedLanguage: 'English', source: 'narrate.enqueue' },
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

    const payload: QueuedNarrationResponse = {
      success: true,
      status: 'queued',
      narrationJobId: voiceGenerationJob.id,
      queueJobId,
      voiceProfileId: profile.id,
    }
    return res.status(202).json(payload)
  } catch (error) {
    logger.error('[narrate] failed to enqueue render', { storyId, error })
    return res.status(503).json({ success: false, error: 'Failed to queue narration render' })
  }
}
