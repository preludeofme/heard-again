import { logger } from '@/lib/logger'
import { getStorageService } from '@/lib/storage/storage-service'
import type {
  TTSProvider,
  UploadReferenceResult,
  UploadReferenceJob,
  SynthesisProgressEvent,
  SynthesisCompleteEvent,
  SynthesisEvent,
} from './tts-provider.types'

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY ?? ''
const RUNPOD_TTS_ENDPOINT_ID = process.env.RUNPOD_TTS_ENDPOINT_ID ?? ''
const POLL_INTERVAL_MS = Number(process.env.RUNPOD_POLL_INTERVAL_MS ?? 1500)
const POLL_TIMEOUT_MS = Number(process.env.RUNPOD_POLL_TIMEOUT_MS ?? 600_000)
const INLINE_THRESHOLD_BYTES = Number(process.env.RUNPOD_INLINE_AUDIO_THRESHOLD_BYTES ?? 1_048_576)

const RUNPOD_BASE = 'https://api.runpod.ai/v2'

type RunPodStatus = 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT'

interface RunPodJobResponse {
  id: string
  status: RunPodStatus
  output?: unknown
  error?: string
  delayTime?: number
  executionTime?: number
}

export class RunPodTTSProvider implements TTSProvider {
  constructor() {
    if (!RUNPOD_TTS_ENDPOINT_ID) {
      throw new Error('RUNPOD_TTS_ENDPOINT_ID is required when TTS_PROVIDER=runpod_serverless')
    }
    if (!RUNPOD_API_KEY) {
      throw new Error('RUNPOD_API_KEY is required when TTS_PROVIDER=runpod_serverless')
    }
  }

  private authHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RUNPOD_API_KEY}`,
    }
  }

  private async submitJob(
    input: Record<string, unknown>,
    sync = false
  ): Promise<RunPodJobResponse> {
    const endpoint = sync ? 'runsync' : 'run'
    const res = await fetch(`${RUNPOD_BASE}/${RUNPOD_TTS_ENDPOINT_ID}/${endpoint}`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify({ input }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`RunPod job submission failed (${res.status}): ${errText}`)
    }

    return res.json() as Promise<RunPodJobResponse>
  }

  private async pollJob(
    jobId: string,
    onProgress?: (event: SynthesisProgressEvent) => Promise<void>
  ): Promise<RunPodJobResponse> {
    const deadline = Date.now() + POLL_TIMEOUT_MS

    while (Date.now() < deadline) {
      const res = await fetch(
        `${RUNPOD_BASE}/${RUNPOD_TTS_ENDPOINT_ID}/status/${jobId}`,
        { headers: this.authHeaders() }
      )

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`RunPod status check failed (${res.status}): ${errText}`)
      }

      const job = (await res.json()) as RunPodJobResponse

      if (job.status === 'COMPLETED') return job
      if (job.status === 'FAILED') {
        throw new Error(`RunPod job failed: ${job.error ?? 'unknown error'}`)
      }
      if (job.status === 'CANCELLED') throw new Error('RunPod job was cancelled')
      if (job.status === 'TIMED_OUT') throw new Error('TTS_JOB_TIMEOUT: RunPod job timed out')

      // Emit a heartbeat progress event so the caller can reflect that synthesis
      // is actively running. RunPod's REST status endpoint does not return
      // per-chunk counts, so sentencesDone/Total stay at 0 (indeterminate).
      if (onProgress && job.status === 'IN_PROGRESS') {
        await onProgress({ type: 'progress', sentencesDone: 0, sentencesTotal: 0 }).catch(() => undefined)
      }

      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }

    throw new Error('TTS_POLL_TIMEOUT: exceeded maximum wait time for RunPod job')
  }

  private async buildAudioInput(
    audioBuffer: Buffer,
    filename: string,
    mimeType: string,
    familyspaceId: string
  ): Promise<Record<string, unknown>> {
    if (audioBuffer.byteLength <= INLINE_THRESHOLD_BYTES) {
      return { audioBase64: audioBuffer.toString('base64'), mimeType, filename }
    }

    const storage = getStorageService()
    const uploaded = await storage.uploadFile(audioBuffer, filename, mimeType, {
      folder: `tts-staging/${familyspaceId}`,
    })
    const provider = storage.getProvider() as unknown as {
      getSecureUrl: (path: string, expiresIn: number) => Promise<{ url: string; expiresAt: Date }>
    }
    const { url: audioUrl } = await provider.getSecureUrl(uploaded.storagePath, 900)
    return { audioUrl, mimeType, filename }
  }

  async uploadReference(
    audioBuffer: Buffer,
    filename: string,
    mimeType: string,
    familyspaceId: string
  ): Promise<UploadReferenceResult> {
    const audioInput = await this.buildAudioInput(audioBuffer, filename, mimeType, familyspaceId)

    const job = await this.submitJob(
      { action: 'upload_reference', familyspaceId, ...audioInput },
      true
    )

    const completed = job.status === 'COMPLETED' ? job : await this.pollJob(job.id)
    return {
      ...(completed.output as Omit<UploadReferenceResult, 'storageType'>),
      storageType: 'CLOUDFLARE_R2',
    }
  }

  async submitUploadReferenceFromUrl(
    audioUrl: string,
    filename: string,
    mimeType: string,
    familyspaceId: string
  ): Promise<{ jobId: string }> {
    const job = await this.submitJob(
      { action: 'upload_reference', familyspaceId, audioUrl, mimeType, filename },
      false
    )
    return { jobId: job.id }
  }

  async submitUploadReference(
    audioBuffer: Buffer,
    filename: string,
    mimeType: string,
    familyspaceId: string
  ): Promise<{ jobId: string }> {
    const audioInput = await this.buildAudioInput(audioBuffer, filename, mimeType, familyspaceId)
    const job = await this.submitJob(
      { action: 'upload_reference', familyspaceId, ...audioInput },
      false  // async /run endpoint
    )
    return { jobId: job.id }
  }

  async checkUploadJob(jobId: string): Promise<UploadReferenceJob> {
    const res = await fetch(
      `${RUNPOD_BASE}/${RUNPOD_TTS_ENDPOINT_ID}/status/${jobId}`,
      { headers: this.authHeaders() }
    )
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`RunPod status check failed (${res.status}): ${errText}`)
    }
    const job = (await res.json()) as RunPodJobResponse

    switch (job.status) {
      case 'COMPLETED': {
        const output = job.output as Record<string, unknown> | null | undefined
        logger.info('[RunPodTTSProvider] checkUploadJob COMPLETED output:', JSON.stringify(output))
        const filePath = (output?.filePath ?? output?.file_path) as string | undefined
        const fileId = (output?.fileId ?? output?.file_id) as string | undefined
        const fileName = (output?.fileName ?? output?.file_name) as string | undefined
        const duration = (output?.duration ?? output?.durationSeconds) as number | undefined
        const transcript = (output?.transcript ?? null) as string | null

        if (!filePath) {
          logger.error('[RunPodTTSProvider] COMPLETED job missing filePath — treating as failed', JSON.stringify(output))
          return { jobId, status: 'failed', error: 'Job completed but returned no file path' }
        }

        return {
          jobId,
          status: 'complete',
          result: {
            fileId: fileId ?? jobId,
            filePath,
            fileName: fileName ?? '',
            duration: duration ?? 0,
            transcript,
            storageType: 'CLOUDFLARE_R2',
          },
        }
      }
      case 'FAILED':
        return { jobId, status: 'failed', error: job.error ?? 'unknown error' }
      case 'CANCELLED':
        return { jobId, status: 'failed', error: 'Job was cancelled' }
      case 'TIMED_OUT':
        return { jobId, status: 'failed', error: 'TTS_JOB_TIMEOUT: job timed out on RunPod' }
      default:
        return {
          jobId,
          status: 'processing',
          runpodStatus: job.status,
          delayTime: job.delayTime,
          executionTime: job.executionTime,
        }
    }
  }

  async submitSynthesisJob(
    profileName: string,
    text: string,
    familyspaceId: string,
    referenceText: string | null
  ): Promise<{ runpodJobId: string }> {
    const job = await this.submitJob({
      action: 'synthesize_batch',
      profileName,
      text,
      familyspaceId,
      referenceText: referenceText ?? undefined,
      language: 'English',
      silencePaddingMs: 200,
    })
    return { runpodJobId: job.id }
  }

  async checkSynthesisJob(runpodJobId: string): Promise<
    | { done: false; runpodStatus: RunPodStatus }
    | { done: true; success: true; event: SynthesisCompleteEvent }
    | { done: true; success: false; error: string }
  > {
    const res = await fetch(
      `${RUNPOD_BASE}/${RUNPOD_TTS_ENDPOINT_ID}/status/${runpodJobId}`,
      { headers: this.authHeaders() }
    )
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`RunPod status check failed (${res.status}): ${errText}`)
    }
    const job = (await res.json()) as RunPodJobResponse
    if (job.status === 'COMPLETED') {
      return { done: true, success: true, event: job.output as SynthesisCompleteEvent }
    }
    if (job.status === 'FAILED') {
      return { done: true, success: false, error: job.error ?? 'RunPod job failed' }
    }
    if (job.status === 'CANCELLED') {
      return { done: true, success: false, error: 'RunPod job was cancelled' }
    }
    if (job.status === 'TIMED_OUT') {
      return { done: true, success: false, error: 'TTS_JOB_TIMEOUT: RunPod job timed out' }
    }
    return { done: false, runpodStatus: job.status }
  }

  async synthesizeBatch(
    profileName: string,
    text: string,
    familyspaceId: string,
    referenceText: string | null,
    onProgress: (event: SynthesisProgressEvent) => Promise<void>,
    onJobSubmitted?: (cloudJobId: string) => Promise<void>
  ): Promise<SynthesisCompleteEvent> {
    const job = await this.submitJob({
      action: 'synthesize_batch',
      profileName,
      text,
      familyspaceId,
      referenceText: referenceText ?? undefined,
      language: 'English',
      silencePaddingMs: 200,
    })

    // Persist the RunPod job ID immediately so callers can rescue if we stall
    if (onJobSubmitted) {
      await onJobSubmitted(job.id).catch(() => undefined)
    }

    try {
      return await this.streamViaWebSocket(job.id, onProgress)
    } catch (err) {
      logger.warn('[RunPodTTSProvider] WebSocket failed, falling back to polling', {
        jobId: job.id,
        err,
      })
      const completed = await this.pollJob(job.id, onProgress)
      return completed.output as SynthesisCompleteEvent
    }
  }

  private streamViaWebSocket(
    jobId: string,
    onProgress: (event: SynthesisProgressEvent) => Promise<void>
  ): Promise<SynthesisCompleteEvent> {
    // Node 21+ exposes WebSocket globally; Node 18/20 do not.
    // Throw here so the caller's catch falls back to polling rather than
    // hitting a ReferenceError mid-Promise construction.
    if (typeof globalThis.WebSocket === 'undefined') {
      return Promise.reject(new Error('WebSocket not available in this Node version — using polling fallback'))
    }

    return new Promise((resolve, reject) => {
      const wsUrl = `wss://api.runpod.ai/v2/${RUNPOD_TTS_ENDPOINT_ID}/ws/${jobId}?apiKey=${RUNPOD_API_KEY}`
      const ws = new WebSocket(wsUrl)

      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error('WebSocket timed out waiting for complete event'))
      }, POLL_TIMEOUT_MS)

      ws.onmessage = async (event: MessageEvent) => {
        let parsed: SynthesisEvent
        try {
          parsed = JSON.parse(event.data as string) as SynthesisEvent
        } catch {
          return
        }

        if (parsed.type === 'progress') {
          await onProgress(parsed).catch(() => undefined)
        } else if (parsed.type === 'complete') {
          clearTimeout(timeout)
          ws.close()
          resolve(parsed)
        } else if (parsed.type === 'error') {
          clearTimeout(timeout)
          ws.close()
          reject(new Error(`RunPod WS error: ${parsed.message}`))
        }
      }

      ws.onerror = (err: Event) => {
        clearTimeout(timeout)
        reject(err)
      }

      ws.onclose = (event: CloseEvent) => {
        if (!event.wasClean) {
          clearTimeout(timeout)
          reject(new Error(`WebSocket closed unexpectedly (code=${event.code})`))
        }
      }
    })
  }

  async downloadAudio(audioId: string, _familyspaceId: string): Promise<Buffer> {
    const storage = getStorageService()
    return storage.getFile(audioId)
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    filename: string,
    mimeType: string,
    familyspaceId: string
  ): Promise<string> {
    const audioInput = await this.buildAudioInput(audioBuffer, filename, mimeType, familyspaceId)

    const job = await this.submitJob(
      { action: 'transcribe', filename, mimeType, ...audioInput },
      true // runsync — transcription is fast enough for a synchronous call
    )

    const completed = job.status === 'COMPLETED' ? job : await this.pollJob(job.id)
    const output = completed.output as { transcript?: string | null } | null
    return output?.transcript ?? ''
  }
}
