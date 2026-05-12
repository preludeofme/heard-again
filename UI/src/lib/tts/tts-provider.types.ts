export interface UploadReferenceResult {
  fileId: string
  filePath: string
  fileName: string
  duration: number
  transcript: string | null
  storageType: 'LOCAL' | 'CLOUDFLARE_R2'
}

export interface SynthesisProgressEvent {
  type: 'progress'
  sentencesDone: number
  sentencesTotal: number
  lastSentenceSeconds?: number
}

export interface SynthesisCompleteEvent {
  type: 'complete'
  audioId: string
  audioUrl: string
  duration: number
  sampleRate: number
  synthesisTime: number
  sentenceCount: number
  format: 'mp3' | 'wav'
  mimeType: string
  fileSize: number
}

export interface SynthesisErrorEvent {
  type: 'error'
  message: string
}

export type SynthesisEvent = SynthesisProgressEvent | SynthesisCompleteEvent | SynthesisErrorEvent

export interface TTSProvider {
  uploadReference(
    audioBuffer: Buffer,
    filename: string,
    mimeType: string,
    familyspaceId: string
  ): Promise<UploadReferenceResult>

  synthesizeBatch(
    profileName: string,
    text: string,
    familyspaceId: string,
    onProgress: (event: SynthesisProgressEvent) => Promise<void>
  ): Promise<SynthesisCompleteEvent>

  downloadAudio(audioId: string, familyspaceId: string): Promise<Buffer>
}
