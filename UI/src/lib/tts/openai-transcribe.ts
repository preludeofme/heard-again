import { logger } from '@/lib/logger'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? ''
const OPENAI_TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL ?? 'whisper-1'

/**
 * Transcribe audio via OpenAI's hosted Whisper API.
 *
 * Replaces the RunPod-hosted Whisper path (and the local TTS REST fallback) as
 * the single transcription provider — decouples transcription from the TTS
 * GPU worker pool entirely (no more contention with voice-cloning synthesis
 * jobs, no GPU/driver dependency).
 *
 * Returns an empty string (rather than throwing) if the API call fails, so
 * callers can treat a missing transcript as non-fatal, matching prior
 * Whisper-unavailable behavior.
 */
export async function transcribeWithOpenAI(
  audioBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  if (!OPENAI_API_KEY) {
    logger.warn('[openai-transcribe] OPENAI_API_KEY not configured — skipping transcription')
    return ''
  }

  try {
    const formData = new FormData()
    formData.append('file', new Blob([new Uint8Array(audioBuffer)], { type: mimeType }), filename)
    formData.append('model', OPENAI_TRANSCRIBE_MODEL)

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: formData,
      signal: AbortSignal.timeout(120_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      logger.warn('[openai-transcribe] transcription request failed', { status: res.status, errText })
      return ''
    }

    const data = (await res.json()) as { text?: string }
    return (data.text ?? '').trim()
  } catch (err: unknown) {
    logger.warn('[openai-transcribe] transcription threw', {
      error: err instanceof Error ? err.message : String(err),
    })
    return ''
  }
}
