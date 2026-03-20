import { useState, useCallback, useEffect } from 'react'
import { ConversationMessage, LegacySubject } from '@/types'
import { mockMessages, mockLegacySubject } from '@/data/mockData'

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
}

interface TalkControllerActions {
  sendMessage: () => Promise<void>
  setInputText: (text: string) => void
  startListening: () => void
  stopListening: () => void
  clearError: () => void
  refreshConversation: () => Promise<void>
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
  })

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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const aiResponse: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'LegacySubject',
        timestamp: new Date(),
        content: generateAIResponse(state.inputText),
        state: 'sent',
      }

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, aiResponse],
        isLoading: false,
        talkState: 'typing',
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage: 'Failed to send message',
      }))
    }
  }, [state.inputText])

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

  return {
    ...state,
    sendMessage,
    setInputText,
    startListening,
    stopListening,
    clearError,
    refreshConversation,
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
