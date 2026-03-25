import { useState, useCallback } from 'react'
import { useSnackbar } from 'notistack'

interface SynthesisCache {
  [key: string]: {
    audioUrl: string
    modelId: string
    text: string
    createdAt: Date
    duration: number
  }
}

interface VoiceSynthesisState {
  isSynthesizing: boolean
  synthesisCache: SynthesisCache
}

interface VoiceSynthesisActions {
  synthesizeSpeech: (modelId: string, text: string) => Promise<string>
  clearSynthesisCache: () => void
  getCachedAudio: (modelId: string, text: string) => string | undefined
}

// Generate cache key for synthesis
function getSynthesisCacheKey(modelId: string, text: string): string {
  return `${modelId}:${text.slice(0, 100)}`
}

export function useVoiceSynthesis(): VoiceSynthesisState & VoiceSynthesisActions {
  const [state, setState] = useState<VoiceSynthesisState>({
    isSynthesizing: false,
    synthesisCache: {},
  })

  const { enqueueSnackbar } = useSnackbar()

  const getCachedAudio = useCallback((modelId: string, text: string): string | undefined => {
    const cacheKey = getSynthesisCacheKey(modelId, text)
    const cached = state.synthesisCache[cacheKey]
    
    // Cache entries expire after 1 hour
    if (cached) {
      const age = Date.now() - cached.createdAt.getTime()
      if (age < 60 * 60 * 1000) {
        return cached.audioUrl
      }
    }
    return undefined
  }, [state.synthesisCache])

  const synthesizeSpeech = useCallback(async (modelId: string, text: string): Promise<string> => {
    // Check cache first
    const cachedUrl = getCachedAudio(modelId, text)
    if (cachedUrl) {
      return cachedUrl
    }

    setState(prev => ({ ...prev, isSynthesizing: true }))

    try {
      const response = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId,
          text,
          language: 'en',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Synthesis failed')
      }

      const result = await response.json()
      
      // Cache the result
      const cacheKey = getSynthesisCacheKey(modelId, text)
      setState(prev => ({
        ...prev,
        isSynthesizing: false,
        synthesisCache: {
          ...prev.synthesisCache,
          [cacheKey]: {
            audioUrl: result.audioUrl,
            modelId,
            text,
            createdAt: new Date(),
            duration: result.duration || 0,
          },
        },
      }))

      return result.audioUrl
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Speech synthesis failed'
      setState(prev => ({ ...prev, isSynthesizing: false }))
      enqueueSnackbar(message, { variant: 'error' })
      throw error
    }
  }, [getCachedAudio, enqueueSnackbar])

  const clearSynthesisCache = useCallback(() => {
    setState(prev => ({ ...prev, synthesisCache: {} }))
  }, [])

  return {
    ...state,
    synthesizeSpeech,
    clearSynthesisCache,
    getCachedAudio,
  }
}
