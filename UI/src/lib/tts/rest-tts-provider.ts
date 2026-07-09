import { logger } from '@/lib/logger'
import type {
  TTSProvider,
  UploadReferenceResult,
  SynthesisProgressEvent,
  SynthesisCompleteEvent,
  SynthesisEvent,
} from './tts-provider.types'

export class RestTTSProvider implements TTSProvider {
  private readonly serviceUrl: string
  private readonly serviceToken: string | undefined

  constructor(serviceUrl?: string) {
    this.serviceUrl = serviceUrl ?? process.env.TTS_SERVICE_URL ?? 'http://127.0.0.1:4779'
    this.serviceToken = process.env.TTS_SERVICE_TOKEN
  }

  private get url() { return this.serviceUrl }
  async createVoiceProfile(
    fileId: string,
    profileName: string,
    styleInstruct?: string | null
  ): Promise<{ profileId: string; profilePath: string }> {
    const response = await fetch(`${this.url}/api/tts/create-voice-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.serviceToken}`,
        'X-Familyspace-Id': 'system',
      },
      body: JSON.stringify({
        fileId,
        profileName,
        styleInstruct: styleInstruct ?? undefined,
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`TTS create-voice-profile failed (${response.status}): ${errorText}`)
    }

    const data = await response.json() as { success: boolean; profileId: string; profilePath: string }
    return { profileId: data.profileId, profilePath: data.profilePath }
  }

  async uploadReference(
    audioBuffer: Buffer,
    filename: string,
    mimeType: string,
    familyspaceId: string
  ): Promise<UploadReferenceResult> {
    const formData = new FormData()
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType })
    formData.append('audio', blob, filename)

    const response = await fetch(`${this.url}/api/tts/upload-reference`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.serviceToken}`,
        'X-Familyspace-Id': familyspaceId,
      },
      body: formData,
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`TTS upload failed (${response.status}): ${errorText}`)
    }

    const data = (await response.json()) as Omit<UploadReferenceResult, 'storageType'>
    return { ...data, storageType: 'LOCAL' as const }
  }

  async synthesizeBatch(
    profileName: string,
    text: string,
    familyspaceId: string,
    _referenceText: string | null,
    onProgress: (event: SynthesisProgressEvent) => Promise<void>,
    _onJobSubmitted?: (cloudJobId: string) => Promise<void>
  ): Promise<SynthesisCompleteEvent> {
    const synthUrl = `${this.url}/api/tts/synthesize-batch`
    let response: Response

    try {
      response = await fetch(synthUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.serviceToken}`,
          'X-Familyspace-Id': familyspaceId,
        },
        body: JSON.stringify({
          profileId: profileName,
          text,
          language: 'English',
          familyspaceId,
          silencePaddingMs: 100,
        }),
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(
        `TTS synth request failed (url=${synthUrl}, tokenConfigured=${Boolean(this.serviceToken)}): ${msg}`
      )
    }

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`TTS batch synth failed (${response.status}): ${errorText}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let finalEvent: SynthesisCompleteEvent | null = null

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
        let event: SynthesisEvent
        try {
          event = JSON.parse(line) as SynthesisEvent
        } catch {
          logger.warn('[RestTTSProvider] failed to parse NDJSON line', { line })
          continue
        }

        if (event.type === 'progress') {
          await onProgress(event)
        } else if (event.type === 'error') {
          throw new Error(`TTS batch synth error: ${event.message}`)
        } else if (event.type === 'complete') {
          finalEvent = event
        }
      }
    }

    if (!finalEvent) throw new Error('TTS batch synth ended without a complete event')
    return finalEvent
  }

  async downloadAudio(audioId: string, familyspaceId: string): Promise<Buffer> {
    const audioUrl = `${this.url}/api/tts/audio/${audioId}`
    let response: Response

    try {
      response = await fetch(audioUrl, {
        headers: {
          Authorization: `Bearer ${this.serviceToken}`,
          'X-Familyspace-Id': familyspaceId,
        },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`TTS audio download failed (url=${audioUrl}): ${msg}`)
    }

    if (!response.ok) {
      throw new Error(`Audio download failed (${response.status}) for ${audioId}`)
    }

    return Buffer.from(await response.arrayBuffer())
  }
}
