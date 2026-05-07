export type AudioProcessingMode = 'safe' | 'enhanced' | 'manual_review'

export type AudioQualityTier = 'excellent' | 'good' | 'usable' | 'poor'

export interface AudioProcessingResult {
  uploadId: string
  familyspaceId: string
  personId?: string
  originalFileUrl: string
  normalizedFileUrl: string
  denoisedFileUrl?: string
  enhancedFileUrl?: string
  cloneReadyFileUrl?: string
  enhancedListeningFileUrl?: string
  detectedSpeakers: number
  selectedSpeakerId?: string
  speakerCountConfidence?: number
  speechDurationSeconds: number
  totalDurationSeconds: number
  signalToNoiseEstimate?: number
  clippingDetected: boolean
  musicDetected: boolean
  processingMode: AudioProcessingMode
  qualityTier: AudioQualityTier
  qualityScore?: number
  warnings: string[]
  stageDurationsMs?: Record<string, number>
  pipelineVersion: string
  createdAt: string
  updatedAt: string
}

export interface RegisterAudioUploadRequest {
  familyspaceId: string
  userId: string
  personId?: string
  fileName: string
  mimeType: string
  processingPreference?: Exclude<AudioProcessingMode, 'manual_review'>
}

export interface RegisterAudioUploadResponse {
  uploadId: string
  originalFileUrl: string
  processedBasePath: string
  message: string
}
