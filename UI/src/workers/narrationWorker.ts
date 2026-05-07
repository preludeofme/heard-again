import { Worker, Job } from 'bullmq'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { storageService } from '@/services/StorageService'
import { TTS_SERVICE_URL } from '@/lib/tts-client'
import {
  NARRATION_QUEUE,
  NarrationRenderJobData,
  NarrationRenderJobProgress,
  getQueueConnection,
} from '@/lib/queues/narrationQueue'

const TTS_SERVICE_TOKEN = process.env.TTS_SERVICE_TOKEN
const WORKER_CONCURRENCY = Math.max(1, parseInt(process.env.NARRATION_WORKER_CONCURRENCY || '1', 10))

type BatchProgressEvent =
  | { type: 'progress'; sentencesDone: number; sentencesTotal: number; lastSentenceSeconds?: number }
  | {
      type: 'complete'
      audioId: string
      audioUrl: string
      duration: number
      sampleRate: number
      synthesisTime: number
      sentenceCount: number
      format?: 'mp3' | 'wav'
      mimeType?: string
      fileSize?: number
    }
  | { type: 'error'; message: string }

const NARRATION_DEFAULT_MIME = 'audio/mpeg'
const NARRATION_DEFAULT_EXT = 'mp3'

function audioExtensionFor(mimeType: string): string {
  if (mimeType === 'audio/mpeg') return 'mp3'
  if (mimeType === 'audio/wav') return 'wav'
  return NARRATION_DEFAULT_EXT
}

async function fetchVoiceProfile(familyspaceId: string, voiceProfileId: string) {
  const profile = await prisma.voiceProfile.findFirst({
    where: { id: voiceProfileId, familyspaceId, status: 'READY' },
    select: { id: true, name: true, personId: true },
  })
  if (!profile) {
    throw new Error(`Voice profile ${voiceProfileId} not found or not READY in familyspace ${familyspaceId}`)
  }
  return profile
}

async function fetchStory(familyspaceId: string, storyId: string) {
  const story = await prisma.story.findFirst({
    where: { id: storyId, familyspaceId },
    select: {
      id: true,
      content: true,
      narratedContent: true,
      narrationStatus: true,
      generatedAudioAssetId: true,
    },
  })
  if (!story) {
    throw new Error(`Story ${storyId} not found in familyspace ${familyspaceId}`)
  }
  return story
}

async function assertConsent(familyspaceId: string, voiceProfileId: string, personId: string | null) {
  if (!personId) return
  const consent = await prisma.voiceConsent.findFirst({
    where: {
      familyspaceId,
      revokedAt: null,
      allowsGeneration: true,
      OR: [{ voiceProfileId }, { personId }],
    },
    orderBy: { recordedAt: 'desc' },
  })
  if (!consent) {
    throw new Error('VOICE_CONSENT_REQUIRED')
  }
}

async function streamBatchSynth(
  profileName: string,
  text: string,
  familyspaceId: string,
  onProgress: (done: number, total: number, lastSecs?: number) => Promise<void>
): Promise<Extract<BatchProgressEvent, { type: 'complete' }>> {
  const synthUrl = `${TTS_SERVICE_URL}/api/tts/synthesize-batch`
  let response: Response
  try {
    response = await fetch(synthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TTS_SERVICE_TOKEN}`,
        'X-Familyspace-Id': familyspaceId,
      },
      body: JSON.stringify({
        profileId: profileName,
        text,
        language: 'English',
        familyspaceId,
        silencePaddingMs: 200,
      }),
    })
  } catch (err: any) {
    const causeCode = err?.cause?.code ? `, causeCode=${err.cause.code}` : ''
    throw new Error(
      `TTS synth request failed (url=${synthUrl}, tokenConfigured=${Boolean(TTS_SERVICE_TOKEN)}${causeCode}): ${err?.message || String(err)}`
    )
  }

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`TTS batch synth failed (${response.status}): ${errorText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let finalEvent: Extract<BatchProgressEvent, { type: 'complete' }> | null = null

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let newlineIdx = buffer.indexOf('\n')
    while (newlineIdx !== -1) {
      const line = buffer.slice(0, newlineIdx).trim()
      buffer = buffer.slice(newlineIdx + 1)
      newlineIdx = buffer.indexOf('\n')

      if (!line) continue
      let event: BatchProgressEvent
      try {
        event = JSON.parse(line) as BatchProgressEvent
      } catch (err) {
        logger.warn('[narrationWorker] failed to parse NDJSON line:', { line, err })
        continue
      }

      if (event.type === 'progress') {
        await onProgress(event.sentencesDone, event.sentencesTotal, event.lastSentenceSeconds)
      } else if (event.type === 'error') {
        throw new Error(`TTS batch synth error: ${event.message}`)
      } else if (event.type === 'complete') {
        finalEvent = event
      }
    }
  }

  if (!finalEvent) {
    throw new Error('TTS batch synth ended without a complete event')
  }
  return finalEvent
}

async function downloadAudio(audioId: string, familyspaceId: string): Promise<Buffer> {
  const audioUrl = `${TTS_SERVICE_URL}/api/tts/audio/${audioId}`
  let response: Response
  try {
    response = await fetch(audioUrl, {
      headers: {
        'Authorization': `Bearer ${TTS_SERVICE_TOKEN}`,
        'X-Familyspace-Id': familyspaceId,
      },
    })
  } catch (err: any) {
    const causeCode = err?.cause?.code ? `, causeCode=${err.cause.code}` : ''
    throw new Error(
      `TTS audio download request failed (url=${audioUrl}, tokenConfigured=${Boolean(TTS_SERVICE_TOKEN)}${causeCode}): ${err?.message || String(err)}`
    )
  }
  if (!response.ok) {
    throw new Error(`Audio download failed (${response.status}) for ${audioId}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function persistAsset(params: {
  familyspaceId: string
  userId: string
  storyId: string
  voiceProfileId: string
  personId: string | null
  audioId: string
  audioBuffer: Buffer
  duration: number
  synthesisTime: number
  sentenceCount: number
  mimeType: string
}): Promise<string> {
  const {
    familyspaceId,
    userId,
    storyId,
    voiceProfileId,
    personId,
    audioId,
    audioBuffer,
    duration,
    synthesisTime,
    sentenceCount,
    mimeType,
  } = params

  const extension = audioExtensionFor(mimeType)

  const storedFile = await storageService.saveAudio(familyspaceId, audioId, audioBuffer, {
    mimeType,
    extension,
  })

  const asset = await prisma.asset.create({
    data: {
      familyspaceId,
      filename: `${audioId}.${extension}`,
      originalName: `${audioId}.${extension}`,
      mimeType,
      sizeBytes: BigInt(audioBuffer.byteLength),
      storageType: 'LOCAL',
      storagePath: storedFile.path,
      assetType: 'GENERATED_AUDIO',
      processingStatus: 'COMPLETED',
      uploadedById: userId,
      durationSeconds: duration,
      metadata: {
        source: 'narration.render',
        ttsAudioId: audioId,
        voiceProfileId,
        personId,
        storyId,
        sentenceCount,
        synthesisTimeSeconds: synthesisTime,
        format: extension,
      },
    },
  })

  return asset.id
}

async function deleteAssetById(assetId: string): Promise<void> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, storagePath: true, assetType: true },
  })
  if (!asset || asset.assetType !== 'GENERATED_AUDIO') return

  await prisma.asset.delete({ where: { id: assetId } }).catch((err) => {
    logger.warn('[narrationWorker] asset.delete failed (non-fatal):', { assetId, err })
  })

  try {
    await storageService.deleteFile(asset.storagePath)
  } catch (err) {
    logger.warn('[narrationWorker] storage delete failed (non-fatal):', { assetId, err })
  }
}

/**
 * Per-(storyId, voiceProfileId) retention: after a new render is persisted,
 * find any other GENERATED_AUDIO assets in the same familyspace that share both
 * `metadata.storyId` and `metadata.voiceProfileId` with the new one and delete them.
 * Leaves assets for *other* voice profiles intact so re-listening with a
 * different voice can hit the cache.
 */
async function pruneSiblingAssetsForPair(params: {
  familyspaceId: string
  storyId: string
  voiceProfileId: string
  keepAssetId: string
}): Promise<number> {
  const { familyspaceId, storyId, voiceProfileId, keepAssetId } = params
  try {
    const siblings = await prisma.asset.findMany({
      where: {
        familyspaceId,
        assetType: 'GENERATED_AUDIO',
        id: { not: keepAssetId },
        AND: [
          { metadata: { path: ['storyId'], equals: storyId } },
          { metadata: { path: ['voiceProfileId'], equals: voiceProfileId } },
        ],
      },
      select: { id: true },
    })
    for (const sibling of siblings) {
      await deleteAssetById(sibling.id)
    }
    return siblings.length
  } catch (err) {
    logger.warn('[narrationWorker] sibling-prune failed (non-fatal)', {
      storyId,
      voiceProfileId,
      err,
    })
    return 0
  }
}

async function handleNarrationRender(job: Job<NarrationRenderJobData>): Promise<{ assetId: string; audioId: string }> {
  const { storyId, familyspaceId, voiceProfileId, userId, voiceGenerationJobId } = job.data

  const updateProgress = async (patch: Partial<NarrationRenderJobProgress>) => {
    const current = (job.progress as NarrationRenderJobProgress | number | undefined) ?? {}
    const merged: NarrationRenderJobProgress = {
      phase: 'queued',
      sentencesDone: 0,
      sentencesTotal: 0,
      ...(typeof current === 'object' ? current : {}),
      ...patch,
    }
    await job.updateProgress(merged)
  }

  logger.info('[narrationWorker] starting render', { storyId, voiceProfileId, jobId: job.id })
  await updateProgress({ phase: 'loading', sentencesDone: 0, sentencesTotal: 0 })

  const [story, profile] = await Promise.all([
    fetchStory(familyspaceId, storyId),
    fetchVoiceProfile(familyspaceId, voiceProfileId),
  ])

  await assertConsent(familyspaceId, voiceProfileId, profile.personId)

  const text = (story.narratedContent || story.content || '').trim()
  if (!text) {
    throw new Error(`Story ${storyId} has no content to narrate`)
  }

  await prisma.voiceGenerationJob.update({
    where: { id: voiceGenerationJobId },
    data: { status: 'PROCESSING', startedAt: new Date() },
  })

  await updateProgress({ phase: 'synthesizing' })

  const startedAt = Date.now()
  const completeEvent = await streamBatchSynth(
    profile.name,
    text,
    familyspaceId,
    async (done, total, lastSecs) => {
      await updateProgress({
        phase: 'synthesizing',
        sentencesDone: done,
        sentencesTotal: total,
        message: lastSecs ? `Last sentence: ${lastSecs.toFixed(1)}s` : undefined,
      })
    }
  )

  await updateProgress({ phase: 'saving', sentencesDone: completeEvent.sentenceCount, sentencesTotal: completeEvent.sentenceCount })

  const audioBuffer = await downloadAudio(completeEvent.audioId, familyspaceId)
  const mimeType = completeEvent.mimeType || NARRATION_DEFAULT_MIME
  const assetId = await persistAsset({
    familyspaceId,
    userId,
    storyId,
    voiceProfileId,
    personId: profile.personId,
    audioId: completeEvent.audioId,
    audioBuffer,
    duration: completeEvent.duration,
    synthesisTime: completeEvent.synthesisTime,
    sentenceCount: completeEvent.sentenceCount,
    mimeType,
  })

  await prisma.$transaction([
    prisma.story.update({
      where: { id: storyId },
      data: {
        generatedAudioAssetId: assetId,
        voiceProfileId,
        narrationRenderJobId: null,
      },
    }),
    prisma.voiceGenerationJob.update({
      where: { id: voiceGenerationJobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        outputAssetId: assetId,
        durationSeconds: completeEvent.duration,
        computeTimeSeconds: completeEvent.synthesisTime,
      },
    }),
  ])

  const prunedCount = await pruneSiblingAssetsForPair({
    familyspaceId,
    storyId,
    voiceProfileId,
    keepAssetId: assetId,
  })

  await updateProgress({
    phase: 'complete',
    sentencesDone: completeEvent.sentenceCount,
    sentencesTotal: completeEvent.sentenceCount,
  })

  const totalSeconds = (Date.now() - startedAt) / 1000
  logger.info('[narrationWorker] render done', {
    storyId,
    voiceProfileId,
    assetId,
    audioId: completeEvent.audioId,
    duration: completeEvent.duration,
    synthesisTime: completeEvent.synthesisTime,
    totalSeconds,
    prunedSiblings: prunedCount,
  })

  return { assetId, audioId: completeEvent.audioId }
}

// Exported for unit testing — the full job-handler pipeline.
export const __narrationWorkerInternals = {
  handleNarrationRender,
  pruneSiblingAssetsForPair,
  deleteAssetById,
}

let workerInstance: Worker<NarrationRenderJobData> | null = null
let workerStarted = false

export function startNarrationWorker(): Worker<NarrationRenderJobData> | null {
  if (workerStarted && workerInstance) return workerInstance

  const enabled = (process.env.NARRATION_WORKER_ENABLED || 'true').toLowerCase() !== 'false'
  if (!enabled) {
    logger.info('[narrationWorker] disabled via NARRATION_WORKER_ENABLED=false')
    return null
  }

  workerInstance = new Worker<NarrationRenderJobData>(NARRATION_QUEUE, handleNarrationRender, {
    connection: getQueueConnection(),
    concurrency: WORKER_CONCURRENCY,
    lockDuration: 5 * 60 * 1000,
  })

  workerInstance.on('failed', async (job, err) => {
    logger.error('[narrationWorker] job failed', {
      jobId: job?.id,
      storyId: job?.data?.storyId,
      error: err.message,
    })

    const voiceGenerationJobId = job?.data?.voiceGenerationJobId
    if (voiceGenerationJobId) {
      await prisma.voiceGenerationJob
        .update({
          where: { id: voiceGenerationJobId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage: err.message.slice(0, 1000),
          },
        })
        .catch((innerErr) => {
          logger.warn('[narrationWorker] failed to mark job FAILED:', innerErr)
        })
    }

    const storyId = job?.data?.storyId
    if (storyId) {
      await prisma.story
        .update({
          where: { id: storyId },
          data: { narrationRenderJobId: null },
        })
        .catch(() => undefined)
    }
  })

  workerInstance.on('completed', (job) => {
    logger.info('[narrationWorker] job completed', { jobId: job.id, storyId: job.data.storyId })
  })

  workerStarted = true
  logger.info('[narrationWorker] started', { concurrency: WORKER_CONCURRENCY })
  return workerInstance
}

export async function stopNarrationWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close()
    workerInstance = null
    workerStarted = false
  }
}
