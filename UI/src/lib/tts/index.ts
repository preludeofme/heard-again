import type { TTSProvider } from './tts-provider.types'
import { RestTTSProvider } from './rest-tts-provider'
import { RunPodTTSProvider } from './runpod-tts-provider'

let instance: TTSProvider | null = null

function resolveTTSServiceUrl(): string {
  // When running in Trigger.dev cloud, use the public Funnel URL instead of localhost.
  // TTS_SERVICE_URL_PUBLIC is synced via trigger.config.ts and set in .env.
  const publicUrl = process.env.TTS_SERVICE_URL_PUBLIC
  if (publicUrl) return publicUrl

  return process.env.TTS_SERVICE_URL ?? 'http://127.0.0.1:4779'
}

export function getTTSProvider(): TTSProvider {
  if (instance) return instance

  const provider = process.env.TTS_PROVIDER ?? 'rest'

  switch (provider) {
    case 'runpod_serverless':
      instance = new RunPodTTSProvider()
      break
    case 'rest':
    default:
      instance = new RestTTSProvider(resolveTTSServiceUrl())
  }

  return instance
}

export type {
  TTSProvider,
  UploadReferenceResult,
  SynthesisProgressEvent,
  SynthesisCompleteEvent,
  SynthesisErrorEvent,
  SynthesisEvent,
} from './tts-provider.types'
