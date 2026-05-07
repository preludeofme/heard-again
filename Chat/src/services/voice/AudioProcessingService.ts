import { v4 as uuidv4 } from 'uuid'
import {
  AudioProcessingMode,
  AudioProcessingResult,
  RegisterAudioUploadRequest,
  RegisterAudioUploadResponse,
} from '@/types/audioProcessing'

const DEFAULT_PIPELINE_VERSION = 'upload-v1'

export class AudioProcessingService {
  private readonly results = new Map<string, AudioProcessingResult>()

  registerUpload(input: RegisterAudioUploadRequest): RegisterAudioUploadResponse {
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

    return {
      uploadId,
      originalFileUrl,
      processedBasePath: baseProcessedPath,
      message: 'Upload registered. Original is immutable; processing artifacts will be written under /processed.',
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
