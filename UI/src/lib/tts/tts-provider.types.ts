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
  /** R2 object key where the audio was stored — not an HTTP URL. Use audioId with downloadAudio(). */
  audioKey: string
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

export interface UploadReferenceJob {
  jobId: string
  status: 'processing' | 'complete' | 'failed'
  /** Raw RunPod status — distinguishes IN_QUEUE (cold start) from IN_PROGRESS (running) */
  runpodStatus?: string
  /** Milliseconds the job spent waiting in queue before a worker picked it up */
  delayTime?: number
  /** Milliseconds the job has been actively executing on a worker */
  executionTime?: number
  result?: UploadReferenceResult
  error?: string
}

export interface TTSProvider {
  /** Async variant: submit job immediately, poll via checkUploadJob. Optional — RunPod only. */
  submitUploadReference?(
    audioBuffer: Buffer,
    filename: string,
    mimeType: string,
    familyspaceId: string
  ): Promise<{ jobId: string }>

  /** URL variant: file already in R2; submit RunPod job with a presigned GET URL. Optional — RunPod only. */
  submitUploadReferenceFromUrl?(
    audioUrl: string,
    filename: string,
    mimeType: string,
    familyspaceId: string
  ): Promise<{ jobId: string }>

  checkUploadJob?(jobId: string): Promise<UploadReferenceJob>

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
    referenceText: string | null,
    onProgress: (event: SynthesisProgressEvent) => Promise<void>,
    onJobSubmitted?: (cloudJobId: string) => Promise<void>
  ): Promise<SynthesisCompleteEvent>

  downloadAudio(audioId: string, familyspaceId: string): Promise<Buffer>

  /** Transcribe audio to text via Whisper. Optional — falls back to TTS REST service if unimplemented. */
  transcribeAudio?(
    audioBuffer: Buffer,
    filename: string,
    mimeType: string,
    familyspaceId: string
  ): Promise<string>
}
