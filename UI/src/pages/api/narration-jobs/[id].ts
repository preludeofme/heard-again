import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { getNarrationQueue, narrationDedupeKey, removeNarrationQueueJob } from '@/lib/queues/narrationQueue'
import { RunPodTTSProvider } from '@/lib/tts/runpod-tts-provider'
import type { SynthesisCompleteEvent } from '@/lib/tts/tts-provider.types'

async function finalizeRunPodJob(params: {
  dbJobId: string
  storyId: string
  voiceProfileId: string
  familyspaceId: string
  userId: string
  personId: string | null
  event: SynthesisCompleteEvent
}): Promise<string | null> {
  const { dbJobId, storyId, voiceProfileId, familyspaceId, userId, personId, event } = params
  const extension = event.format === 'wav' ? 'wav' : 'mp3'
  const audioFilename = event.audioId.split('/').pop() ?? `${event.audioId}.${extension}`

  // Check-before-create to avoid duplicate assets in the narrow race window
  const pre = await prisma.voiceGenerationJob.findUnique({
    where: { id: dbJobId },
    select: { status: true, outputAssetId: true },
  })
  if (pre?.status === 'COMPLETED') return pre.outputAssetId ?? null

  const asset = await prisma.asset.create({
    data: {
      familyspaceId,
      filename: audioFilename,
      originalName: audioFilename,
      mimeType: event.mimeType,
      sizeBytes: BigInt(event.fileSize),
      storageType: 'CLOUDFLARE_R2',
      storagePath: event.audioId,
      assetType: 'GENERATED_AUDIO',
      processingStatus: 'COMPLETED',
      uploadedById: userId,
      durationSeconds: event.duration,
      metadata: {
        source: 'narration.rescue',
        ttsAudioId: event.audioId,
        voiceProfileId,
        personId,
        storyId,
        sentenceCount: event.sentenceCount,
        synthesisTimeSeconds: event.synthesisTime,
        format: extension,
      },
    },
    select: { id: true },
  })

  // Atomic update — only if job is still non-terminal (guards against concurrent rescue)
  const updated = await prisma.voiceGenerationJob.updateMany({
    where: { id: dbJobId, status: { in: ['QUEUED', 'PROCESSING'] } },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      outputAssetId: asset.id,
      durationSeconds: event.duration,
      computeTimeSeconds: event.synthesisTime,
    },
  })

  if (updated.count === 0) {
    // Another finalizer (BullMQ worker) beat us — discard our duplicate asset
    await prisma.asset.delete({ where: { id: asset.id } }).catch(() => undefined)
    const fresh = await prisma.voiceGenerationJob.findUnique({
      where: { id: dbJobId },
      select: { outputAssetId: true },
    })
    return fresh?.outputAssetId ?? null
  }

  await prisma.story
    .updateMany({
      where: { id: storyId },
      data: { generatedAudioAssetId: asset.id, voiceProfileId, narrationRenderJobId: null },
    })
    .catch(() => undefined)

  logger.info('[narration-jobs] rescue finalized RunPod job', { dbJobId, assetId: asset.id })
  return asset.id
}

interface NarrationJobStatusResponse {
  success: boolean
  jobId: string
  storyId: string | null
  status: 'queued' | 'processing' | 'synthesizing' | 'saving' | 'completed' | 'failed'
  sentencesDone: number
  sentencesTotal: number
  assetId: string | null
  assetDownloadUrl: string | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  durationSeconds: number | null
}

type QueuePhase = 'queued' | 'loading' | 'synthesizing' | 'saving' | 'complete' | 'failed'
interface QueueProgressShape {
  phase?: QueuePhase
  sentencesDone?: number
  sentencesTotal?: number
  message?: string
}

function mapStatus(
  dbStatus: string,
  phase: QueuePhase | undefined
): NarrationJobStatusResponse['status'] {
  if (dbStatus === 'COMPLETED') return 'completed'
  if (dbStatus === 'FAILED') return 'failed'
  if (dbStatus === 'QUEUED') return 'queued'
  if (phase === 'synthesizing') return 'synthesizing'
  if (phase === 'saving') return 'saving'
  return 'processing'
}

async function handleCancel(req: NextApiRequest, res: NextApiResponse) {
  let user
  try {
    user = await getAuthUserWithFamilyspace(req, res)
  } catch {
    return
  }
  await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

  const jobId = req.query.id as string

  const dbJob = await prisma.voiceGenerationJob.findFirst({
    where: { id: jobId, story: { familyspaceId: user.familyspaceId } },
    select: { id: true, status: true, storyId: true, voiceProfileId: true },
  })

  if (!dbJob) {
    return res.status(404).json({ success: false, error: 'Narration job not found' })
  }

  if (dbJob.status === 'COMPLETED') {
    return res.status(409).json({ success: false, error: 'Job is already completed' })
  }
  if (dbJob.status === 'CANCELLED') {
    return res.status(200).json({ success: true, cancelled: true })
  }

  await prisma.$transaction([
    prisma.voiceGenerationJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    }),
    prisma.story.updateMany({
      where: { id: dbJob.storyId ?? '', narrationRenderJobId: jobId },
      data: { narrationRenderJobId: null },
    }),
  ])

  // Remove from BullMQ unconditionally. Active jobs will finish on the worker
  // but discard the result once they see CANCELLED in the DB.
  if (dbJob.storyId && dbJob.voiceProfileId) {
    await removeNarrationQueueJob(dbJob.storyId, dbJob.voiceProfileId).catch((err) => {
      logger.warn('[narration-jobs] BullMQ removal on cancel failed (non-fatal)', { jobId, err })
    })
  }

  return res.status(200).json({ success: true, cancelled: true })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'DELETE') return handleCancel(req, res)

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'DELETE'])
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  let user
  try {
    user = await getAuthUserWithFamilyspace(req, res)
  } catch {
    return
  }

  await requireFamilyspaceRole(user.id, user.familyspaceId, 'VIEWER')

  const jobId = req.query.id as string
  if (!jobId) {
    return res.status(400).json({ success: false, error: 'jobId is required' })
  }

  const dbJob = await prisma.voiceGenerationJob.findFirst({
    where: {
      id: jobId,
      story: { familyspaceId: user.familyspaceId },
    },
    select: {
      id: true,
      storyId: true,
      status: true,
      startedAt: true,
      completedAt: true,
      errorMessage: true,
      outputAssetId: true,
      durationSeconds: true,
      voiceProfileId: true,
      cloudJobId: true,
      voiceProfile: { select: { personId: true } },
    },
  })

  if (!dbJob) {
    return res.status(404).json({ success: false, error: 'Narration job not found' })
  }

  let phase: QueuePhase | undefined
  let sentencesDone = 0
  let sentencesTotal = 0

  const isTerminal = dbJob.status === 'COMPLETED' || dbJob.status === 'FAILED' || dbJob.status === 'CANCELLED'

  if (!isTerminal && dbJob.storyId) {
    // Rescue path: if cloudJobId is stored, check RunPod status directly.
    // This fires whether or not the BullMQ worker is alive, catches the worker-stalled case fast.
    if (dbJob.cloudJobId) {
      try {
        const tts = new RunPodTTSProvider()
        const result = await tts.checkSynthesisJob(dbJob.cloudJobId)

        if (result.done && result.success) {
          const assetId = await finalizeRunPodJob({
            dbJobId: dbJob.id,
            storyId: dbJob.storyId,
            voiceProfileId: dbJob.voiceProfileId,
            familyspaceId: user.familyspaceId,
            userId: user.id,
            personId: dbJob.voiceProfile?.personId ?? null,
            event: result.event,
          })
          res.setHeader('Cache-Control', 'no-store')
          return res.status(200).json({
            success: true,
            jobId: dbJob.id,
            storyId: dbJob.storyId,
            status: 'completed',
            sentencesDone: result.event.sentenceCount,
            sentencesTotal: result.event.sentenceCount,
            assetId: assetId,
            assetDownloadUrl: assetId ? `/api/assets/serve/${assetId}` : null,
            errorMessage: null,
            startedAt: dbJob.startedAt?.toISOString() ?? null,
            completedAt: new Date().toISOString(),
            durationSeconds: result.event.duration,
          } satisfies NarrationJobStatusResponse)
        }

        if (result.done && !result.success) {
          await prisma.voiceGenerationJob
            .updateMany({
              where: { id: dbJob.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
              data: { status: 'FAILED', completedAt: new Date(), errorMessage: result.error.slice(0, 1000) },
            })
            .catch(() => undefined)
          res.setHeader('Cache-Control', 'no-store')
          return res.status(200).json({
            success: true,
            jobId: dbJob.id,
            storyId: dbJob.storyId,
            status: 'failed',
            sentencesDone: 0,
            sentencesTotal: 0,
            assetId: null,
            assetDownloadUrl: null,
            errorMessage: result.error,
            startedAt: dbJob.startedAt?.toISOString() ?? null,
            completedAt: new Date().toISOString(),
            durationSeconds: null,
          } satisfies NarrationJobStatusResponse)
        }

        // Still running on RunPod
        phase = 'synthesizing'
      } catch (err) {
        logger.warn('[narration-jobs] RunPod rescue check failed (non-fatal)', { jobId, err })
      }
    }

    // BullMQ progress overlay — shows granular sentence progress while worker is active
    try {
      const queue = getNarrationQueue()
      const dedupeKey = narrationDedupeKey(dbJob.storyId, dbJob.voiceProfileId)
      const queueJob = await queue.getJob(dedupeKey)
      if (queueJob) {
        const progress = queueJob.progress as QueueProgressShape | number | undefined
        if (progress && typeof progress === 'object') {
          phase = progress.phase ?? phase
          sentencesDone = progress.sentencesDone ?? sentencesDone
          sentencesTotal = progress.sentencesTotal ?? sentencesTotal
        }
      }
    } catch (err) {
      logger.warn('[narration-jobs] queue progress lookup failed (non-fatal)', { jobId, err })
    }
  }

  const status = mapStatus(dbJob.status, phase)
  const response: NarrationJobStatusResponse = {
    success: true,
    jobId: dbJob.id,
    storyId: dbJob.storyId,
    status,
    sentencesDone,
    sentencesTotal,
    assetId: dbJob.outputAssetId,
    assetDownloadUrl: dbJob.outputAssetId ? `/api/assets/serve/${dbJob.outputAssetId}` : null,
    errorMessage: dbJob.errorMessage,
    startedAt: dbJob.startedAt ? dbJob.startedAt.toISOString() : null,
    completedAt: dbJob.completedAt ? dbJob.completedAt.toISOString() : null,
    durationSeconds: dbJob.durationSeconds,
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json(response)
}
