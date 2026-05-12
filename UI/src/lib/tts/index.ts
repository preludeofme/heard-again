import type { TTSProvider } from './tts-provider.types'
import { RestTTSProvider } from './rest-tts-provider'
import { RunPodTTSProvider } from './runpod-tts-provider'

let instance: TTSProvider | null = null

export function getTTSProvider(): TTSProvider {
  if (instance) return instance

  const provider = process.env.TTS_PROVIDER ?? 'rest'

  switch (provider) {
    case 'runpod_serverless':
      instance = new RunPodTTSProvider()
      break
    case 'rest':
    default:
      instance = new RestTTSProvider()
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
