import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import {
  enqueueNarrationRender,
  getNarrationQueue,
  narrationDedupeKey,
  removeNarrationQueueJob,
} from '@/lib/queues/narrationQueue'

// Jobs stuck in PROCESSING longer than this are considered stale and force-cleared on retry.
const STALE_PROCESSING_TIMEOUT_MS = 20 * 60 * 1000

/**
 * If an existing BullMQ job for this (storyId, voiceProfileId) pair maps to a DB job
 * that is already in a terminal state (FAILED/CANCELLED) or has been PROCESSING for
 * longer than STALE_PROCESSING_TIMEOUT_MS, remove it from the queue so enqueueNarrationRender
 * can create a fresh one.
 */
async function clearStaleQueueJobIfNeeded(storyId: string, voiceProfileId: string): Promise<void> {
  const queue = getNarrationQueue()
  const existing = await queue.getJob(narrationDedupeKey(storyId, voiceProfileId)).catch(() => null)
  if (!existing) return

  const state = await existing.getState().catch(() => 'unknown')
  // delayed is already handled by enqueueNarrationRender; focus on active/waiting that map to dead DB jobs.
  if (state !== 'active' && state !== 'waiting') return

  const dbJob = await prisma.voiceGenerationJob
    .findUnique({
      where: { id: existing.data.voiceGenerationJobId },
      select: { status: true, startedAt: true },
    })
    .catch(() => null)

  if (!dbJob) return

  const isTerminal = dbJob.status === 'FAILED' || dbJob.status === 'CANCELLED'
  const isStale =
    dbJob.status === 'PROCESSING' &&
    dbJob.startedAt !== null &&
    Date.now() - dbJob.startedAt.getTime() > STALE_PROCESSING_TIMEOUT_MS

  if (!isTerminal && !isStale) return

  logger.warn('[narrate] clearing stale queue job before re-enqueue', {
    storyId,
    voiceProfileId,
    bqState: state,
    dbStatus: dbJob.status,
    startedAt: dbJob.startedAt,
  })

  if (isStale) {
    await prisma.voiceGenerationJob
      .update({
        where: { id: existing.data.voiceGenerationJobId },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: 'Stale job force-cleared on retry (exceeded 20 min timeout)' },
      })
      .catch(() => undefined)
  }

  await removeNarrationQueueJob(storyId, voiceProfileId)
}

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
  familyspaceId: string,
  storyId: string,
  voiceProfileId: string
): Promise<{ id: string } | null> {
  return prisma.asset.findFirst({
    where: {
      familyspaceId,
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
    user = await getAuthUserWithFamilyspace(req, res)
  } catch {
    return
  }

  const storyId = req.query.id as string
  const voiceProfileIdParam = req.query.voiceProfileId as string | undefined

  const story = await prisma.story.findFirst({
    where: { id: storyId, familyspaceId: user.familyspaceId },
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
        familyspaceId: user.familyspaceId,
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

  const cachedAsset = await findCachedAsset(user.familyspaceId, storyId, profileId)
  if (cachedAsset) {
    res.setHeader('X-Narration-Source', 'cache')
    if (wantsJson(req)) {
      const payload: CachedNarrationResponse = {
        success: true,
        status: 'ready',
        assetId: cachedAsset.id,
        assetDownloadUrl: `/api/assets/serve/${cachedAsset.id}`,
        voiceProfileId: profileId,
      }
      return res.status(200).json(payload)
    }
    return res.redirect(302, `/api/assets/serve/${cachedAsset.id}`)
  }

  const profile = await prisma.voiceProfile.findFirst({
    where: { id: profileId, familyspaceId: user.familyspaceId, status: 'READY' },
    select: { id: true, name: true, personId: true },
  })
  if (!profile) {
    return res.status(404).json({ success: false, error: 'Voice profile not found or not ready' })
  }

  if (profile.personId) {
    const consent = await prisma.voiceConsent.findFirst({
      where: {
        familyspaceId: user.familyspaceId,
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
    await clearStaleQueueJobIfNeeded(storyId, profile.id)

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

    const enqueueResult = await enqueueNarrationRender({
      storyId,
      familyspaceId: user.familyspaceId,
      voiceProfileId: profile.id,
      userId: user.id,
      voiceGenerationJobId: voiceGenerationJob.id,
    })

    if (enqueueResult.deduped) {
      await prisma.voiceGenerationJob.delete({ where: { id: voiceGenerationJob.id } }).catch(() => undefined)
      const payload: QueuedNarrationResponse = {
        success: true,
        status: 'queued',
        narrationJobId: enqueueResult.existingVoiceGenerationJobId ?? voiceGenerationJob.id,
        queueJobId: enqueueResult.queueJobId,
        voiceProfileId: profile.id,
      }
      return res.status(202).json(payload)
    }

    await prisma.story.update({
      where: { id: storyId },
      data: { narrationRenderJobId: voiceGenerationJob.id },
    })

    const payload: QueuedNarrationResponse = {
      success: true,
      status: 'queued',
      narrationJobId: voiceGenerationJob.id,
      queueJobId: enqueueResult.queueJobId,
      voiceProfileId: profile.id,
    }
    return res.status(202).json(payload)
  } catch (error) {
    logger.error('[narrate] failed to enqueue render', { storyId, error })
    return res.status(503).json({ success: false, error: 'Failed to queue narration render' })
  }
}
