import { useCallback, useEffect, useState } from 'react'
import { ConversationMessage } from '@/types'

type TalkState = 'idle' | 'listening' | 'typing' | 'processing'

interface ConversationState {
  messages: ConversationMessage[]
  inputText: string
  talkState: TalkState
  isLoading: boolean
  isListening: boolean
}

interface ConversationActions {
  sendMessage: () => Promise<void>
  setInputText: (text: string) => void
  startListening: () => void
  stopListening: () => void
  refreshConversation: () => Promise<void>
}

interface UseConversationOptions {
  onAssistantMessage?: (text: string) => Promise<void>
  onError?: (message: string) => void
  generateResponse?: (userMessage: string) => string
}

function defaultGenerateResponse(): string {
  const responses = [
    "That's a wonderful memory. I remember that day so clearly...",
    'Yes, those were such special times. Let me tell you more about it...',
    "I'm so glad you asked about that. It brings back such warm feelings...",
    'Ah, that takes me back. I was just thinking about that the other day...',
    'Thank you for sharing that with me. It means so much to hear these memories...',
  ]

  return responses[Math.floor(Math.random() * responses.length)]
}

export function useConversation({
  onAssistantMessage,
  onError,
  generateResponse = defaultGenerateResponse,
}: UseConversationOptions = {}): ConversationState & ConversationActions {
  const [state, setState] = useState<ConversationState>({
    messages: [],
    inputText: '',
    talkState: 'idle',
    isLoading: false,
    isListening: false,
  })

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

    const userInput = state.inputText

    const userMessage: ConversationMessage = {
      id: Date.now().toString(),
      sender: 'User',
      timestamp: new Date(),
      content: userInput,
      state: 'sent',
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      inputText: '',
      isLoading: true,
    }))

    try {
      await new Promise(resolve => setTimeout(resolve, 1500))

      const responseText = generateResponse(userInput)
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

      if (onAssistantMessage) {
        await onAssistantMessage(responseText)
      }
    } catch {
      setState(prev => ({
        ...prev,
        isLoading: false,
      }))
      onError?.('Failed to send message')
    }
  }, [generateResponse, onAssistantMessage, onError, state.inputText])

  const setInputText = useCallback((text: string) => {
    setState(prev => ({ ...prev, inputText: text }))
  }, [])

  const startListening = useCallback(() => {
    setState(prev => ({
      ...prev,
      isListening: true,
      talkState: 'listening',
    }))

    setTimeout(() => {
      setState(prev => ({
        ...prev,
        isListening: false,
        talkState: 'processing',
        inputText: 'This is a simulated voice message about a fond memory.',
      }))

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

  const refreshConversation = useCallback(async () => {
    setState(prev => ({
      ...prev,
      isLoading: true,
    }))

    try {
      setState(prev => ({
        ...prev,
        messages: [],
        isLoading: false,
      }))
    } catch {
      setState(prev => ({
        ...prev,
        isLoading: false,
      }))
      onError?.('Failed to refresh conversation')
    }
  }, [onError])

  return {
    ...state,
    sendMessage,
    setInputText,
    startListening,
    stopListening,
    refreshConversation,
  }
}
