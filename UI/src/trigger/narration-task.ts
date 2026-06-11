import { task, metadata, logger as triggerLogger } from '@trigger.dev/sdk/v3'
import type { DeserializedJson } from '@trigger.dev/core'
import { prisma } from '@/lib/prisma'
import { getStorageService } from '@/lib/storage/storage-service'
import { getTTSProvider } from '@/lib/tts'
import { logger } from '@/lib/logger'
import { incrementGenerationMinutes } from '@/lib/entitlements'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NarrationTaskPayload {
  storyId: string
  familyspaceId: string
  voiceProfileId: string
  userId: string
  voiceGenerationJobId: string
}

export interface NarrationTaskProgress {
  phase: 'queued' | 'loading' | 'synthesizing' | 'saving' | 'complete' | 'failed'
  /** @deprecated Use chunksDone instead */
  sentencesDone: number
  /** @deprecated Use chunksTotal instead */
  sentencesTotal: number
  chunksDone: number
  chunksTotal: number
  message?: string
}

export interface NarrationTaskOutput {
  assetId: string
  audioId: string
}

// ─── Helpers (ported from narrationWorker.ts) ─────────────────────────────────

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
    select: {
      id: true,
      name: true,
      externalId: true,
      personId: true,
      sourceTranscript: true,
      sourceAsset: { select: { transcript: true } },
    },
  })
  if (!profile) {
    throw new Error(
      `Voice profile ${voiceProfileId} not found or not READY in familyspace ${familyspaceId}`
    )
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

async function assertConsent(
  familyspaceId: string,
  voiceProfileId: string,
  personId: string | null
): Promise<void> {
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
    throw new Error(
      'Voice consent is required before generating audio with this profile.'
    )
  }
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
  const audioFilename = audioId.split('/').pop() ?? `${audioId}.${extension}`
  const libStorage = getStorageService()
  const uploadResult = await libStorage.uploadFile(audioBuffer, audioFilename, mimeType, {
    folder: `generated-audio/${familyspaceId}`,
  })
  const storageType = libStorage.getMode() === 'local' ? 'LOCAL' : 'CLOUDFLARE_R2'

  const asset = await prisma.asset.create({
    data: {
      familyspaceId,
      filename: audioFilename,
      originalName: audioFilename,
      mimeType,
      sizeBytes: BigInt(audioBuffer.byteLength),
      storageType,
      storagePath: uploadResult.storagePath,
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

  await prisma.asset.delete({ where: { id: assetId } }).catch((err: unknown) => {
    logger.warn('[narrationTask] asset.delete failed (non-fatal):', { assetId, err })
  })
  try {
    await getStorageService().deleteFile(asset.storagePath)
  } catch (err) {
    logger.warn('[narrationTask] storage delete failed (non-fatal):', { assetId, err })
  }
}

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
    logger.warn('[narrationTask] sibling-prune failed (non-fatal)', {
      storyId,
      voiceProfileId,
      err,
    })
    return 0
  }
}

// ─── Task ─────────────────────────────────────────────────────────────────────

export const narrationTask = task({
  id: 'narration-render',
  maxDuration: 3600,
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5_000,
    factor: 2,
  },

  run: async (payload: NarrationTaskPayload): Promise<NarrationTaskOutput> => {
    const { storyId, familyspaceId, voiceProfileId, userId, voiceGenerationJobId } = payload

    const updateProgress = async (patch: Partial<NarrationTaskProgress>): Promise<void> => {
      const current = (await metadata.get('progress') ?? {}) as Partial<NarrationTaskProgress>
      // Resolve chunk counts: prefer explicit chunksDone/chunksTotal, fall back to legacy sentencesDone/sentencesTotal
      const resolvedChunksDone = patch.chunksDone ?? patch.sentencesDone ?? current.chunksDone ?? current.sentencesDone ?? 0
      const resolvedChunksTotal = patch.chunksTotal ?? patch.sentencesTotal ?? current.chunksTotal ?? current.sentencesTotal ?? 0
      const merged: NarrationTaskProgress = {
        phase: 'queued',
        ...current,
        ...patch,
        // Keep both fields in sync for backward compatibility with legacy polling clients
        chunksDone: resolvedChunksDone,
        chunksTotal: resolvedChunksTotal,
        sentencesDone: resolvedChunksDone,
        sentencesTotal: resolvedChunksTotal,
      }
      await metadata.set('progress', merged as unknown as DeserializedJson)
    }

    triggerLogger.info('starting narration render', { storyId, voiceProfileId })
    await updateProgress({ phase: 'loading', sentencesDone: 0, sentencesTotal: 0 })

    const [story, profile] = await Promise.all([
      fetchStory(familyspaceId, storyId),
      fetchVoiceProfile(familyspaceId, voiceProfileId),
    ])

    await assertConsent(familyspaceId, voiceProfileId, profile.personId)

    const text = (
      story.narrationStatus === 'APPROVED' && story.narratedContent
        ? story.narratedContent
        : story.content || ''
    ).trim()
    if (!text) throw new Error(`Story ${storyId} has no content to narrate`)

    await prisma.voiceGenerationJob.update({
      where: { id: voiceGenerationJobId },
      data: { status: 'PROCESSING', startedAt: new Date(), errorMessage: null },
    })

    await updateProgress({ phase: 'synthesizing' })

    if (!profile.externalId) {
      throw new Error(
        `Voice profile ${voiceProfileId} has no externalId — was it created before the RunPod migration?`
      )
    }

    const provider = getTTSProvider()
    const referenceText = profile.sourceTranscript ?? profile.sourceAsset?.transcript ?? null
    const startedAt = Date.now()

    const completeEvent = await provider.synthesizeBatch(
      profile.externalId,
      text,
      familyspaceId,
      referenceText,
      async (event) => {
        await updateProgress({
          phase: 'synthesizing',
          chunksDone: event.sentencesDone,
          chunksTotal: event.sentencesTotal,
          message: event.lastSentenceSeconds
            ? `Last chunk: ${event.lastSentenceSeconds.toFixed(1)}s`
            : undefined,
        })
      },
      async (cloudJobId) => {
        await prisma.voiceGenerationJob
          .update({ where: { id: voiceGenerationJobId }, data: { cloudJobId } })
          .catch(() => undefined)
      }
    )

    await updateProgress({
      phase: 'saving',
      chunksDone: completeEvent.sentenceCount,
      chunksTotal: completeEvent.sentenceCount,
    })

    const currentStatus = await prisma.voiceGenerationJob.findUnique({
      where: { id: voiceGenerationJobId },
      select: { status: true },
    })
    if (currentStatus?.status === 'CANCELLED') {
      triggerLogger.info('job cancelled during synthesis — discarding result', {
        storyId,
        voiceGenerationJobId,
      })
      return { assetId: '', audioId: completeEvent.audioId }
    }

    const audioBuffer = await provider.downloadAudio(completeEvent.audioId, familyspaceId)
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

    await pruneSiblingAssetsForPair({
      familyspaceId,
      storyId,
      voiceProfileId,
      keepAssetId: assetId,
    })

    // Track usage on the subscription
    if (completeEvent.duration) {
      await incrementGenerationMinutes(familyspaceId, completeEvent.duration).catch((err) =>
        logger.warn('[narrationTask] failed to increment generation minutes', { storyId, err })
      )
    }

    await updateProgress({
      phase: 'complete',
      chunksDone: completeEvent.sentenceCount,
      chunksTotal: completeEvent.sentenceCount,
    })

    const totalSeconds = (Date.now() - startedAt) / 1000
    triggerLogger.info('narration render complete', {
      storyId,
      voiceProfileId,
      assetId,
      duration: completeEvent.duration,
      totalSeconds,
    })

    return { assetId, audioId: completeEvent.audioId }
  },

  onFailure: async ({ payload, error }: { payload: NarrationTaskPayload; error: unknown }): Promise<void> => {
    logger.error('[narrationTask] exhausted retries', {
      storyId: payload.storyId,
      error: error instanceof Error ? error.message : String(error),
    })
    await prisma.voiceGenerationJob
      .updateMany({
        where: {
          id: payload.voiceGenerationJobId,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage:
            error instanceof Error ? error.message.slice(0, 1_000) : 'Unknown error',
        },
      })
      .catch(() => undefined)

    await prisma.story
      .updateMany({
        where: {
          id: payload.storyId,
          narrationRenderJobId: payload.voiceGenerationJobId,
        },
        data: { narrationRenderJobId: null },
      })
      .catch(() => undefined)
  },
})
