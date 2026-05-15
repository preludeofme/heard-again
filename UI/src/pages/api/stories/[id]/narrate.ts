import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { narrationTask } from '@/trigger/narration-task'
import { auth, runs } from '@trigger.dev/sdk/v3'

const STALE_PROCESSING_TIMEOUT_MS = 20 * 60 * 1_000

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
  triggerRunId: string
  publicAccessToken: string
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
  const textSourceParam = req.query.textSource as string | undefined
  const requestedTextSource: 'original' | 'narrated' | null =
    textSourceParam === 'original' || textSourceParam === 'narrated' ? textSourceParam : null

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

  const useNarrated =
    requestedTextSource === 'narrated'
      ? story.narrationStatus === 'APPROVED' && !!story.narratedContent
      : requestedTextSource === 'original'
        ? false
        : story.narrationStatus === 'APPROVED' && !!story.narratedContent

  const text = useNarrated ? story.narratedContent! : story.content
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
    // Check for an already-active job for this story+profile pair.
    // Dedup is handled at the DB level so we never rely on Trigger.dev idempotency
    // returning the right (non-terminal) run — completed runs share the same key
    // but should produce a fresh execution.
    const activeJob = await prisma.voiceGenerationJob.findFirst({
      where: {
        storyId,
        voiceProfileId: profile.id,
        status: { in: ['QUEUED', 'PROCESSING'] },
      },
      select: { id: true, triggerRunId: true, status: true, startedAt: true },
      orderBy: { createdAt: 'desc' },
    })

    if (activeJob) {
      const isStale =
        activeJob.status === 'PROCESSING' &&
        activeJob.startedAt !== null &&
        Date.now() - activeJob.startedAt.getTime() > STALE_PROCESSING_TIMEOUT_MS

      if (!isStale && activeJob.triggerRunId) {
        // Verify the run is still active. A QUEUED job whose task failed before
        // it could update the DB (e.g. Prisma init error) will have a terminal
        // run forever, blocking all future re-renders for this story+profile pair.
        const TERMINAL_STATUSES = new Set([
          'COMPLETED_SUCCESSFULLY', 'COMPLETED_WITH_ERRORS',
          'FAILED', 'CRASHED', 'CANCELED', 'TIMED_OUT',
          'SYSTEM_FAILURE', 'INTERRUPTED', 'EXPIRED',
        ])
        let runIsActive = false
        try {
          const liveRun = await runs.retrieve(activeJob.triggerRunId)
          runIsActive = !TERMINAL_STATUSES.has(liveRun.status)
        } catch {
          // Can't reach Trigger.dev — assume not active, create a fresh run
        }

        if (runIsActive) {
          // Genuinely in-flight — issue a fresh read token and return immediately
          const publicAccessToken = await auth.createPublicToken({
            scopes: { read: { runs: [activeJob.triggerRunId] } },
            expirationTime: '2h',
          })
          return res.status(202).json({
            success: true,
            status: 'queued',
            narrationJobId: activeJob.id,
            triggerRunId: activeJob.triggerRunId,
            publicAccessToken,
            voiceProfileId: profile.id,
          } satisfies QueuedNarrationResponse)
        }
      }

      // Stale or terminal run — cancel and fall through to create a fresh run
      logger.warn('[narrate] cancelling stale/terminal Trigger.dev job', {
        storyId,
        voiceProfileId: profile.id,
        jobId: activeJob.id,
        triggerRunId: activeJob.triggerRunId,
        isStale,
      })
      if (activeJob.triggerRunId) {
        await runs.cancel(activeJob.triggerRunId).catch(() => undefined)
      }
      await prisma.voiceGenerationJob
        .update({
          where: { id: activeJob.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage: isStale
              ? 'Stale job force-cleared on retry (exceeded 20 min timeout)'
              : 'Job superseded — Trigger.dev run was no longer active',
          },
        })
        .catch(() => undefined)
    }

    const voiceGenerationJob = await prisma.voiceGenerationJob.create({
      data: {
        voiceProfileId: profile.id,
        storyId,
        text: text.substring(0, 10_000),
        status: 'QUEUED',
        styleOverride: { requestedLanguage: 'English', source: 'narrate.enqueue' },
      },
      select: { id: true },
    })

    // Idempotency key is scoped to the job ID so the same HTTP request can be
    // safely retried, but a fresh request always creates a new Trigger.dev run.
    const run = await narrationTask.trigger(
      {
        storyId,
        familyspaceId: user.familyspaceId,
        voiceProfileId: profile.id,
        userId: user.id,
        voiceGenerationJobId: voiceGenerationJob.id,
      },
      {
        idempotencyKey: `narration:job:${voiceGenerationJob.id}`,
        tags: [`story:${storyId}`, `family:${user.familyspaceId}`],
      }
    )

    await prisma.voiceGenerationJob.update({
      where: { id: voiceGenerationJob.id },
      data: { triggerRunId: run.id },
    })

    await prisma.story.update({
      where: { id: storyId },
      data: { narrationRenderJobId: voiceGenerationJob.id },
    })

    const publicAccessToken = await auth.createPublicToken({
      scopes: { read: { runs: [run.id] } },
      expirationTime: '2h',
    })

    return res.status(202).json({
      success: true,
      status: 'queued',
      narrationJobId: voiceGenerationJob.id,
      triggerRunId: run.id,
      publicAccessToken,
      voiceProfileId: profile.id,
    } satisfies QueuedNarrationResponse)
  } catch (error) {
    logger.error('[narrate] failed to trigger render', { storyId, error })
    return res.status(503).json({ success: false, error: 'Failed to queue narration render' })
  }
}
