import { useState, useCallback, useEffect, useRef } from 'react'
import { LegacySubject, VoiceModel } from '@/types'
import { useVoicePlayback } from './useVoicePlayback'
import { useConversation } from './useConversation'
import { useChatConversation } from './useChatConversation'
import { useVoiceComparison } from './useVoiceComparison'
import { useTalkSynthesis } from './useTalkSynthesis'
import { useTalkVoiceModels } from './useTalkVoiceModels'

interface TalkControllerErrorState {
  hasError: boolean
  errorMessage: string | null
}

export function useTalkController(subjectId?: string) {
  const selectedVoiceModelRef = useRef<VoiceModel | null>(null)
  const synthesizeSpeechRef = useRef<(text: string, modelId?: string) => Promise<string | null>>(async () => null)
  const playAudioRef = useRef<(audioUrl: string) => void>(() => {})

  const [errorState, setErrorState] = useState<TalkControllerErrorState>({
    hasError: false,
    errorMessage: null,
  })

  const legacySubject: LegacySubject = {
    id: '',
    fullName: '',
    lifespanText: '',
    bio: '',
    avatarUrl: '',
    accentIcon: 'heart',
  }

  const voiceModels = useTalkVoiceModels(subjectId, {
    onError: (message: string) => {
      setErrorState({ hasError: true, errorMessage: message })
    },
  })

  const playback = useVoicePlayback((message) => {
    setErrorState({ hasError: true, errorMessage: message })
  })

  const onAssistantMessage = useCallback(async (text: string) => {
    const selectedModel = selectedVoiceModelRef.current
    if (!selectedModel) return
    try {
      const audioUrl = await synthesizeSpeechRef.current(text, selectedModel.id)
      if (audioUrl) playAudioRef.current(audioUrl)
    } catch (e) {
      console.warn('[TALK] Voice synthesis for response failed (non-critical):', e)
    }
  }, [])

  const onConversationError = useCallback((message: string) => {
    setErrorState({ hasError: true, errorMessage: message })
  }, [])

  // Always call both hooks unconditionally (Rules of Hooks)
  const chatConversation = useChatConversation({
    subjectId,
    onAssistantMessage,
    onError: onConversationError,
  })

  const mockConversation = useConversation({
    onAssistantMessage,
    onError: onConversationError,
  })

  // Select the active conversation based on whether a real subject is selected
  const conversation = subjectId ? chatConversation : mockConversation

  const synthesis = useTalkSynthesis({
    selectedVoiceModelId: voiceModels.selectedVoiceModel?.id,
    onError: (message) => {
      setErrorState({ hasError: true, errorMessage: message })
    },
  })

  const clearError = useCallback(() => {
    setErrorState({ hasError: false, errorMessage: null })
  }, [])

  useEffect(() => {
    selectedVoiceModelRef.current = voiceModels.selectedVoiceModel
  }, [voiceModels.selectedVoiceModel])

  const comparison = useVoiceComparison({
    voiceModels: voiceModels.voiceModels,
    synthesizeSpeech: synthesis.synthesizeSpeech,
  })

  // Keep refs in sync so sendMessage can call these without hoisting issues
  useEffect(() => {
    synthesizeSpeechRef.current = synthesis.synthesizeSpeech
    playAudioRef.current = playback.playAudio
  }, [synthesis.synthesizeSpeech, playback.playAudio])

  return {
    hasError: errorState.hasError,
    errorMessage: errorState.errorMessage,
    legacySubject,
    messages: conversation.messages,
    inputText: conversation.inputText,
    talkState: conversation.talkState,
    isLoading: conversation.isLoading,
    isListening: conversation.isListening,
    voiceModels: voiceModels.voiceModels,
    selectedVoiceModel: voiceModels.selectedVoiceModel,
    audioCache: synthesis.audioCache,
    isPlayingAudio: playback.isPlayingAudio,
    currentAudioUrl: playback.currentAudioUrl,
    synthesisStatus: synthesis.synthesisStatus,
    lastSynthesisJobId: synthesis.lastSynthesisJobId,
    lastSynthesisOutputAssetDownloadUrl: synthesis.lastSynthesisOutputAssetDownloadUrl,
    voiceComparisonMode: comparison.voiceComparisonMode,
    comparisonModelA: comparison.comparisonModelA,
    comparisonModelB: comparison.comparisonModelB,
    sendMessage: conversation.sendMessage,
    setInputText: conversation.setInputText,
    startListening: conversation.startListening,
    stopListening: conversation.stopListening,
    clearError,
    refreshConversation: conversation.refreshConversation,
    loadVoiceModels: voiceModels.loadVoiceModels,
    selectVoiceModel: voiceModels.selectVoiceModel,
    synthesizeSpeech: synthesis.synthesizeSpeech,
    playAudio: playback.playAudio,
    stopAudio: playback.stopAudio,
    toggleVoiceComparison: comparison.toggleVoiceComparison,
    setComparisonModels: comparison.setComparisonModels,
    setComparisonModelA: comparison.setComparisonModelA,
    setComparisonModelB: comparison.setComparisonModelB,
    compareVoices: comparison.compareVoices,
    // Persona-related properties — only meaningful when a real subjectId is active
    personaExists: chatConversation.personaExists,
    personaConfidence: chatConversation.personaConfidence,
    needsPersonaGeneration: chatConversation.needsPersonaGeneration,
    generatePersona: chatConversation.generatePersona,
    checkPersonaExists: chatConversation.checkPersonaExists,
    // Session management
    sessions: chatConversation.sessions,
    isLoadingSessions: chatConversation.isLoadingSessions,
    loadSessions: chatConversation.loadSessions,
    switchSession: chatConversation.switchSession,
    deleteSession: chatConversation.deleteSession,
  }
}
