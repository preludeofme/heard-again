import { useState, useCallback, useEffect, useRef } from 'react'
import { ConversationMessage, LegacySubject, VoiceModel, AudioCache, VoiceSynthesisResponse } from '@/types'
import { mockMessages, mockLegacySubject } from '@/data/mockData'
import { logger } from '@/lib/client-logger'

type TalkState = 'idle' | 'listening' | 'typing' | 'processing'

interface TalkControllerState {
  messages: ConversationMessage[]
  legacySubject: LegacySubject
  inputText: string
  talkState: TalkState
  isLoading: boolean
  hasError: boolean
  errorMessage: string | null
  isListening: boolean
  voiceModels: VoiceModel[]
  selectedVoiceModel: VoiceModel | null
  audioCache: AudioCache
  isPlayingAudio: boolean
  currentAudioUrl: string | null
  voiceComparisonMode: boolean
  comparisonModelA: VoiceModel | null
  comparisonModelB: VoiceModel | null
}

interface TalkControllerActions {
  sendMessage: () => Promise<void>
  setInputText: (text: string) => void
  startListening: () => void
  stopListening: () => void
  clearError: () => void
  refreshConversation: () => Promise<void>
  loadVoiceModels: () => Promise<void>
  selectVoiceModel: (model: VoiceModel) => void
  synthesizeSpeech: (text: string, modelId?: string) => Promise<string | null>
  playAudio: (audioUrl: string) => void
  stopAudio: () => void
  toggleVoiceComparison: () => void
  setComparisonModels: (modelA: VoiceModel, modelB: VoiceModel) => void
  compareVoices: (text: string) => Promise<{ audioA: string | null; audioB: string | null }>
}

export function useTalkController(): TalkControllerState & TalkControllerActions {
  const [state, setState] = useState<TalkControllerState>({
    messages: mockMessages,
    legacySubject: mockLegacySubject,
    inputText: '',
    talkState: 'idle',
    isLoading: false,
    hasError: false,
    errorMessage: null,
    isListening: false,
    voiceModels: [],
    selectedVoiceModel: null,
    audioCache: {},
    isPlayingAudio: false,
    currentAudioUrl: null,
    voiceComparisonMode: false,
    comparisonModelA: null,
    comparisonModelB: null,
  })
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const synthesizeSpeechRef = useRef<(text: string, modelId?: string) => Promise<string | null>>(async () => null)
  const playAudioRef = useRef<(audioUrl: string) => void>(() => {})

  // Simulate typing indicator
  useEffect(() => {
    if (state.talkState === 'typing') {
      const timer = setTimeout(() => {
        setState(prev => ({
          ...prev,
          talkState: 'idle',
        }))
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [state.talkState])

  const sendMessage = useCallback(async () => {
    if (!state.inputText.trim()) return

    const userMessage: ConversationMessage = {
      id: Date.now().toString(),
      sender: 'User',
      timestamp: new Date(),
      content: state.inputText,
      state: 'sent',
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      inputText: '',
      isLoading: true,
      hasError: false,
      errorMessage: null,
    }))

    try {
      // Simulate API call for AI text response
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const responseText = generateAIResponse(state.inputText)
      const aiResponse: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'LegacySubject',
        timestamp: new Date(),
        content: responseText,
        state: 'sent',
      }

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, aiResponse],
        isLoading: false,
        talkState: 'typing',
      }))

      // Auto-synthesize voice for the AI response if a voice model is selected
      if (state.selectedVoiceModel) {
        try {
          const audioUrl = await synthesizeSpeechRef.current(responseText, state.selectedVoiceModel.id)
          if (audioUrl) {
            playAudioRef.current(audioUrl)
          }
        } catch (e) {
          console.warn('[TALK] Voice synthesis for response failed (non-critical):', e)
        }
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage: 'Failed to send message',
      }))
    }
  }, [state.inputText, state.selectedVoiceModel])

  const setInputText = useCallback((text: string) => {
    setState(prev => ({ ...prev, inputText: text }))
  }, [])

  const startListening = useCallback(() => {
    setState(prev => ({
      ...prev,
      isListening: true,
      talkState: 'listening',
    }))

    // Simulate voice recognition
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        isListening: false,
        talkState: 'processing',
        inputText: "This is a simulated voice message about a fond memory.",
      }))

      // Simulate processing
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          talkState: 'idle',
        }))
      }, 1000)
    }, 3000)
  }, [])

  const stopListening = useCallback(() => {
    setState(prev => ({
      ...prev,
      isListening: false,
      talkState: 'idle',
    }))
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      hasError: false,
      errorMessage: null,
    }))
  }, [])

  const refreshConversation = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, hasError: false, errorMessage: null }))
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setState(prev => ({
        ...prev,
        messages: mockMessages, // In real app, this would be fresh data
        isLoading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage: 'Failed to refresh conversation',
      }))
    }
  }, [])

  // Load available voice models
  const loadVoiceModels = useCallback(async () => {
    try {
      console.log('[TALK] Loading voice models...')
      const response = await fetch('/api/voice/models')
      const data = await response.json()
      
      console.log('[TALK] Models API response:', data)
      
      if (data.success) {
        console.log('[TALK] Found models:', data.models?.length || 0)
        setState(prev => ({
          ...prev,
          voiceModels: data.models || [],
          selectedVoiceModel: data.models && data.models.length > 0 ? data.models[0] : null,
        }))
      } else {
        console.error('[TALK] Models API returned success=false:', data)
      }
    } catch (error: any) {
      console.error('[TALK] Failed to load voice models:', error)
      await logger.logError('Failed to load voice models', { error: error?.message || String(error) })
    }
  }, [])

  // Select a voice model
  const selectVoiceModel = useCallback((model: VoiceModel) => {
    setState(prev => ({ ...prev, selectedVoiceModel: model }))
  }, [])

  // Synthesize speech with caching
  const synthesizeSpeech = useCallback(async (text: string, modelId?: string): Promise<string | null> => {
    const targetModelId = modelId || state.selectedVoiceModel?.id
    
    if (!targetModelId) {
      setState(prev => ({
        ...prev,
        hasError: true,
        errorMessage: 'No voice model selected',
      }))
      return null
    }

    // Check cache first
    const cacheKey = `${targetModelId}_${text.substring(0, 100)}`
    if (state.audioCache[cacheKey]) {
      return state.audioCache[cacheKey].audioUrl
    }

    try {
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

      const data: VoiceSynthesisResponse = await response.json()
      
      if (data.success) {
        // Cache the result
        setState(prev => ({
          ...prev,
          audioCache: {
            ...prev.audioCache,
            [cacheKey]: {
              audioUrl: data.audioUrl,
              modelId: targetModelId,
              text,
              createdAt: new Date(),
              duration: data.duration,
            },
          },
        }))
        
        return data.audioUrl
      }
      
      return null
    } catch (error: any) {
      console.error('Speech synthesis error:', error)
      await logger.logError('Speech synthesis failed', { 
        modelId: targetModelId, 
        textLength: text.length,
        error: error?.message || String(error)
      })
      return null
    }
  }, [state.selectedVoiceModel, state.audioCache])

  // Play audio
  const playAudio = useCallback((audioUrl: string) => {
    if (audioRef.current) {
      audioRef.current.pause()
    }

    const audio = new Audio(audioUrl)
    audioRef.current = audio
    
    setState(prev => ({ ...prev, isPlayingAudio: true, currentAudioUrl: audioUrl }))
    
    audio.onended = () => {
      setState(prev => ({ ...prev, isPlayingAudio: false, currentAudioUrl: null }))
    }
    
    audio.onerror = () => {
      setState(prev => ({ 
        ...prev, 
        isPlayingAudio: false, 
        currentAudioUrl: null,
        hasError: true,
        errorMessage: 'Failed to play audio',
      }))
    }
    
    audio.play()
  }, [])

  // Keep refs in sync so sendMessage can call these without hoisting issues
  useEffect(() => {
    synthesizeSpeechRef.current = synthesizeSpeech
    playAudioRef.current = playAudio
  }, [synthesizeSpeech, playAudio])

  // Stop audio
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    
    setState(prev => ({ ...prev, isPlayingAudio: false, currentAudioUrl: null }))
  }, [])

  // Toggle voice comparison mode
  const toggleVoiceComparison = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      voiceComparisonMode: !prev.voiceComparisonMode,
      comparisonModelA: !prev.voiceComparisonMode && prev.voiceModels.length > 0 ? prev.voiceModels[0] : null,
      comparisonModelB: !prev.voiceComparisonMode && prev.voiceModels.length > 1 ? prev.voiceModels[1] : null,
    }))
  }, [])

  // Set comparison models
  const setComparisonModels = useCallback((modelA: VoiceModel, modelB: VoiceModel) => {
    setState(prev => ({
      ...prev,
      comparisonModelA: modelA,
      comparisonModelB: modelB,
    }))
  }, [])

  // Compare voices
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

  // Load voice models on mount
  useEffect(() => {
    loadVoiceModels()
  }, [loadVoiceModels])

  return {
    ...state,
    sendMessage,
    setInputText,
    startListening,
    stopListening,
    clearError,
    refreshConversation,
    loadVoiceModels,
    selectVoiceModel,
    synthesizeSpeech,
    playAudio,
    stopAudio,
    toggleVoiceComparison,
    setComparisonModels,
    compareVoices,
  }
}

// Helper function to generate AI responses
function generateAIResponse(userMessage: string): string {
  const responses = [
    "That's a wonderful memory. I remember that day so clearly...",
    "Yes, those were such special times. Let me tell you more about it...",
    "I'm so glad you asked about that. It brings back such warm feelings...",
    "Ah, that takes me back. I was just thinking about that the other day...",
    "Thank you for sharing that with me. It means so much to hear these memories...",
  ]
  
  return responses[Math.floor(Math.random() * responses.length)]
}
