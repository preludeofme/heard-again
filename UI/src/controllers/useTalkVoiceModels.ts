import { useCallback, useEffect, useRef, useState } from 'react'
import { VoiceModel } from '@/types'
import { logger } from '@/lib/client-logger'

interface TalkVoiceModelsState {
  voiceModels: VoiceModel[]
  selectedVoiceModel: VoiceModel | null
}

interface TalkVoiceModelsActions {
  loadVoiceModels: () => Promise<void>
  selectVoiceModel: (model: VoiceModel) => void
}

interface UseTalkVoiceModelsOptions {
  onError?: (message: string) => void
}

export function useTalkVoiceModels(
  subjectId?: string,
  options: UseTalkVoiceModelsOptions = {}
): TalkVoiceModelsState & TalkVoiceModelsActions {
  const { onError } = options
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const [state, setState] = useState<TalkVoiceModelsState>({
    voiceModels: [],
    selectedVoiceModel: null,
  })

  const loadVoiceModels = useCallback(async () => {
    try {
      const url = subjectId ? `/api/voice/profiles?personId=${encodeURIComponent(subjectId)}` : '/api/voice/profiles'
      const response = await fetch(url, { credentials: 'include' })
      const data = await response.json()

      if (!data.success) {
        return
      }

      const profiles = data.data || []
      const models: VoiceModel[] = profiles.map((p: {
        id: string
        name: string
        displayName?: string
        status?: string
        language?: string
        sampleCount?: number
        createdAt: string
        modelPath?: string
        similarityScore?: number
      }) => ({
        id: p.id,
        name: p.name,
        displayName: p.displayName || p.name,
        status: (p.status || 'READY').toLowerCase() as 'training' | 'ready' | 'failed',
        language: p.language || 'en',
        sampleCount: p.sampleCount || 0,
        createdAt: p.createdAt,
        modelPath: p.modelPath,
        similarityScore: p.similarityScore,
        userId: '',
      }))

      setState(prev => ({
        ...prev,
        voiceModels: models,
        selectedVoiceModel: prev.selectedVoiceModel ?? (models.length > 0 ? models[0] : null),
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load voice models'
      onErrorRef.current?.('Failed to load voice models')
      await logger.logError('Failed to load voice models', { error: message })
    }
  }, [subjectId])

  const selectVoiceModel = useCallback((model: VoiceModel) => {
    setState(prev => ({
      ...prev,
      selectedVoiceModel: model,
    }))
  }, [])

  useEffect(() => {
    void loadVoiceModels()
  }, [loadVoiceModels])

  return {
    ...state,
    loadVoiceModels,
    selectVoiceModel,
  }
}
