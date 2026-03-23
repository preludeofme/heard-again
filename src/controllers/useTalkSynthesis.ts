import { useCallback, useState } from 'react'
import { AudioCache, VoiceSynthesisResponse } from '@/types'
import { logger } from '@/lib/client-logger'

interface TalkSynthesisState {
  audioCache: AudioCache
  synthesisStatus: 'idle' | 'processing' | 'completed' | 'failed'
  lastSynthesisJobId: string | null
  lastSynthesisOutputAssetDownloadUrl: string | null
}

interface TalkSynthesisActions {
  synthesizeSpeech: (text: string, modelId?: string) => Promise<string | null>
}

interface UseTalkSynthesisOptions {
  selectedVoiceModelId?: string
  onError?: (message: string) => void
}

export function useTalkSynthesis({
  selectedVoiceModelId,
  onError,
}: UseTalkSynthesisOptions = {}): TalkSynthesisState & TalkSynthesisActions {
  const [state, setState] = useState<TalkSynthesisState>({
    audioCache: {},
    synthesisStatus: 'idle',
    lastSynthesisJobId: null,
    lastSynthesisOutputAssetDownloadUrl: null,
  })

  const sleep = useCallback((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)), [])

  const pollVoiceJobUntilFinal = useCallback(async (jobId: string) => {
    const maxAttempts = 8

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await fetch(`/api/voice/jobs/${jobId}`)
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to poll voice generation job')
      }

      const job = payload.data as {
        status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
        errorMessage: string | null
        outputAssetDownloadUrl: string | null
      }

      if (job.status === 'FAILED') {
        throw new Error(job.errorMessage || 'Voice generation job failed')
      }

      if (job.status === 'COMPLETED') {
        return job
      }

      setState(prev => ({
        ...prev,
        synthesisStatus: 'processing',
      }))

      await sleep(600)
    }

    throw new Error('Voice generation job timed out')
  }, [sleep])

  const synthesizeSpeech = useCallback(async (text: string, modelId?: string): Promise<string | null> => {
    const targetModelId = modelId || selectedVoiceModelId

    if (!targetModelId) {
      onError?.('No voice model selected')
      return null
    }

    const cacheKey = `${targetModelId}_${text.substring(0, 100)}`
    if (state.audioCache[cacheKey]) {
      return state.audioCache[cacheKey].audioUrl
    }

    try {
      setState(prev => ({
        ...prev,
        synthesisStatus: 'processing',
      }))

      const response = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: targetModelId,
          text,
          language: 'en',
          speed: 1.0,
          pitch: 1.0,
        }),
      })

      const data = await response.json()
      const synthesisData = data as VoiceSynthesisResponse & {
        jobId?: string
        outputAssetDownloadUrl?: string | null
        error?: string
      }

      if (!response.ok || !synthesisData.success) {
        const message = synthesisData.error || 'Speech synthesis failed'
        setState(prev => ({
          ...prev,
          synthesisStatus: 'failed',
        }))
        onError?.(message)
        return null
      }

      let outputAssetDownloadUrl = synthesisData.outputAssetDownloadUrl || null

      if (synthesisData.jobId) {
        const job = await pollVoiceJobUntilFinal(synthesisData.jobId)
        if (job.outputAssetDownloadUrl) {
          outputAssetDownloadUrl = job.outputAssetDownloadUrl
        }
      }

      setState(prev => ({
        ...prev,
        synthesisStatus: 'completed',
        lastSynthesisJobId: synthesisData.jobId || null,
        lastSynthesisOutputAssetDownloadUrl: outputAssetDownloadUrl,
        audioCache: {
          ...prev.audioCache,
          [cacheKey]: {
            audioUrl: synthesisData.audioUrl,
            modelId: targetModelId,
            text,
            createdAt: new Date(),
            duration: synthesisData.duration,
          },
        },
      }))

      return synthesisData.audioUrl
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Speech synthesis failed'
      await logger.logError('Speech synthesis failed', {
        modelId: targetModelId,
        textLength: text.length,
        error: message,
      })

      setState(prev => ({
        ...prev,
        synthesisStatus: 'failed',
      }))
      onError?.(message)
      return null
    }
  }, [onError, pollVoiceJobUntilFinal, selectedVoiceModelId, state.audioCache])

  return {
    ...state,
    synthesizeSpeech,
  }
}
