import { v4 as uuidv4 } from 'uuid'
import {
  AudioProcessingMode,
  AudioProcessingResult,
  RegisterAudioUploadRequest,
  RegisterAudioUploadResponse,
} from '@/types/audioProcessing'
import { queueManager, QUEUE_NAMES } from '@/utils/queues'

const DEFAULT_PIPELINE_VERSION = 'upload-v1'

export class AudioProcessingService {
  private readonly results = new Map<string, AudioProcessingResult>()

  async registerUpload(input: RegisterAudioUploadRequest): Promise<RegisterAudioUploadResponse> {
    const uploadId = uuidv4()
    const encodedName = encodeURIComponent(input.fileName)
    const originalFileUrl = `/originals/${input.userId}/${uploadId}/${encodedName}`

    const baseProcessedPath = `/processed/${input.userId}/${uploadId}`

    const now = new Date().toISOString()
    const mode: AudioProcessingMode = input.processingPreference ?? 'safe'
    const defaultResult: AudioProcessingResult = {
      uploadId,
      familyspaceId: input.familyspaceId,
      personId: input.personId,
      originalFileUrl,
      normalizedFileUrl: `${baseProcessedPath}/normalized.wav`,
      denoisedFileUrl: `${baseProcessedPath}/denoised.wav`,
      enhancedFileUrl: mode === 'enhanced' ? `${baseProcessedPath}/enhanced.wav` : undefined,
      cloneReadyFileUrl: `${baseProcessedPath}/clone_ready.wav`,
      enhancedListeningFileUrl: mode === 'enhanced' ? `${baseProcessedPath}/enhanced.wav` : undefined,
      detectedSpeakers: 1,
      speechDurationSeconds: 0,
      totalDurationSeconds: 0,
      clippingDetected: false,
      musicDetected: false,
      processingMode: mode,
      qualityTier: 'usable',
      warnings: [],
      stageDurationsMs: {},
      pipelineVersion: DEFAULT_PIPELINE_VERSION,
      createdAt: now,
      updatedAt: now,
    }

    this.results.set(uploadId, defaultResult)

    // Add to audio processing queue for the worker to pick up
    try {
      const queue = queueManager.createQueue(QUEUE_NAMES.AUDIO_PROCESSING)
      await queue.add('process-audio', {
        uploadId,
        familyspaceId: input.familyspaceId,
        userId: input.userId,
        personId: input.personId,
        fileName: input.fileName,
        originalFileUrl,
        mode
      })
    } catch (err) {
      console.error('[AudioProcessingService] Failed to queue job:', err)
      // We still return success for registration as the DB/Map entry is created
    }

    return {
      uploadId,
      originalFileUrl,
      processedBasePath: baseProcessedPath,
      message: 'Upload registered and queued for processing. Original is immutable; processing artifacts will be written under /processed.',
    }
  }

  upsertProcessingResult(result: AudioProcessingResult): AudioProcessingResult {
    const existing = this.results.get(result.uploadId)
    const now = new Date().toISOString()

    const merged: AudioProcessingResult = {
      ...(existing ?? result),
      ...result,
      createdAt: existing?.createdAt ?? result.createdAt ?? now,
      updatedAt: now,
    }

    this.results.set(result.uploadId, merged)
    return merged
  }

  getProcessingResult(uploadId: string): AudioProcessingResult | null {
    return this.results.get(uploadId) ?? null
  }
}

export const audioProcessingService = new AudioProcessingService()
