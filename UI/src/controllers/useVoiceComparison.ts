import { useCallback, useState } from 'react'
import { VoiceModel } from '@/types'

interface VoiceComparisonState {
  voiceComparisonMode: boolean
  comparisonModelA: VoiceModel | null
  comparisonModelB: VoiceModel | null
}

interface VoiceComparisonActions {
  toggleVoiceComparison: () => void
  setComparisonModels: (modelA: VoiceModel, modelB: VoiceModel) => void
  setComparisonModelA: (model: VoiceModel) => void
  setComparisonModelB: (model: VoiceModel) => void
  compareVoices: (text: string) => Promise<{ audioA: string | null; audioB: string | null }>
}

interface UseVoiceComparisonOptions {
  voiceModels: VoiceModel[]
  synthesizeSpeech: (text: string, modelId?: string) => Promise<string | null>
}

export function useVoiceComparison({
  voiceModels,
  synthesizeSpeech,
}: UseVoiceComparisonOptions): VoiceComparisonState & VoiceComparisonActions {
  const [state, setState] = useState<VoiceComparisonState>({
    voiceComparisonMode: false,
    comparisonModelA: null,
    comparisonModelB: null,
  })

  const toggleVoiceComparison = useCallback(() => {
    setState(prev => ({
      ...prev,
      voiceComparisonMode: !prev.voiceComparisonMode,
      comparisonModelA: !prev.voiceComparisonMode && voiceModels.length > 0 ? voiceModels[0] : null,
      comparisonModelB: !prev.voiceComparisonMode && voiceModels.length > 1 ? voiceModels[1] : null,
    }))
  }, [voiceModels])

  const setComparisonModels = useCallback((modelA: VoiceModel, modelB: VoiceModel) => {
    setState(prev => ({
      ...prev,
      comparisonModelA: modelA,
      comparisonModelB: modelB,
    }))
  }, [])

  const setComparisonModelA = useCallback((model: VoiceModel) => {
    setState(prev => ({ ...prev, comparisonModelA: model }))
  }, [])

  const setComparisonModelB = useCallback((model: VoiceModel) => {
    setState(prev => ({ ...prev, comparisonModelB: model }))
  }, [])

  const compareVoices = useCallback(async (text: string): Promise<{ audioA: string | null; audioB: string | null }> => {
    if (!state.comparisonModelA || !state.comparisonModelB) {
      return { audioA: null, audioB: null }
    }

    const [audioA, audioB] = await Promise.all([
      synthesizeSpeech(text, state.comparisonModelA.id),
      synthesizeSpeech(text, state.comparisonModelB.id),
    ])

    return { audioA, audioB }
  }, [state.comparisonModelA, state.comparisonModelB, synthesizeSpeech])

  return {
    ...state,
    toggleVoiceComparison,
    setComparisonModels,
    setComparisonModelA,
    setComparisonModelB,
    compareVoices,
  }
}
