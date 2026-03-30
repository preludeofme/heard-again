import { useCallback, useEffect, useState } from 'react'
import { ConversationMessage } from '@/types'

type TalkState = 'idle' | 'listening' | 'typing' | 'processing'

interface ChatConversationState {
  messages: ConversationMessage[]
  inputText: string
  talkState: TalkState
  isLoading: boolean
  isListening: boolean
  sessionId?: string
}

interface ChatConversationActions {
  sendMessage: () => Promise<void>
  setInputText: (text: string) => void
  startListening: () => void
  stopListening: () => void
  refreshConversation: () => Promise<void>
  setSessionId: (sessionId: string) => void
}

interface UseChatConversationOptions {
  subjectId?: string
  onAssistantMessage?: (text: string) => Promise<void>
  onError?: (message: string) => void
}

export function useChatConversation({
  subjectId,
  onAssistantMessage,
  onError,
}: UseChatConversationOptions = {}): ChatConversationState & ChatConversationActions {
  const [state, setState] = useState<ChatConversationState>({
    messages: [],
    inputText: '',
    talkState: 'idle',
    isLoading: false,
    isListening: false,
  })

  // Initialize or get chat session when subjectId changes
  useEffect(() => {
    if (subjectId) {
      initializeChatSession()
    }
  }, [subjectId])

  const initializeChatSession = async () => {
    try {
      // Create a new chat session for this subject
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': 'default', // TODO: Get from auth context
          'x-user-id': 'default', // TODO: Get from auth context
        },
        credentials: 'include',
        body: JSON.stringify({
          personId: subjectId,
          title: `Chat with ${subjectId}`,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create chat session')
      }

      const data = await response.json()
      if (data.success) {
        setState(prev => ({ ...prev, sessionId: data.session.id }))
        
        // Load existing messages if any
        await loadChatHistory(data.session.id)
      }
    } catch (error) {
      console.error('Failed to initialize chat session:', error)
      onError?.('Failed to start conversation')
    }
  }

  const loadChatHistory = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat/messages?sessionId=${sessionId}`, {
        headers: {
          'x-workspace-id': 'default',
          'x-user-id': 'default',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        return
      }

      const data = await response.json()
      if (data.success && data.messages) {
        const formattedMessages = data.messages.map((msg: any) => ({
          id: msg.id,
          sender: msg.role === 'user' ? 'User' : 'LegacySubject',
          timestamp: new Date(msg.createdAt),
          content: msg.content,
          state: 'sent' as const,
        }))

        setState(prev => ({ ...prev, messages: formattedMessages }))
      }
    } catch (error) {
      console.error('Failed to load chat history:', error)
    }
  }

  const sendMessage = useCallback(async () => {
    if (!state.inputText.trim() || !state.sessionId) return

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
      talkState: 'processing',
    }))

    try {
      // Use streaming for better UX
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': 'default',
          'x-user-id': 'default',
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: state.sessionId,
          message: userInput,
          options: {
            maxRetrievedDocuments: 5,
            temperature: 0.7,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let assistantMessage: ConversationMessage | null = null
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'start') {
                assistantMessage = {
                  id: data.messageId || Date.now().toString(),
                  sender: 'LegacySubject',
                  timestamp: new Date(),
                  content: '',
                  state: 'sent',
                }
                
                setState(prev => ({
                  ...prev,
                  messages: [...prev.messages, assistantMessage!],
                  talkState: 'typing',
                }))
              } else if (data.type === 'chunk' && assistantMessage) {
                fullContent += data.content
                assistantMessage.content = fullContent
                
                setState(prev => ({
                  ...prev,
                  messages: prev.messages.map(msg => 
                    msg.id === assistantMessage!.id ? assistantMessage! : msg
                  ),
                }))
              } else if (data.type === 'end') {
                setState(prev => ({
                  ...prev,
                  isLoading: false,
                  talkState: 'idle',
                }))

                if (onAssistantMessage && fullContent) {
                  await onAssistantMessage(fullContent)
                }
                break
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Stream error')
              }
            } catch (parseError) {
              console.error('Failed to parse chunk:', parseError)
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        talkState: 'idle',
      }))
      onError?.('Failed to send message')
    }
  }, [state.inputText, state.sessionId, onAssistantMessage, onError])

  const setInputText = useCallback((text: string) => {
    setState(prev => ({ ...prev, inputText: text }))
  }, [])

  const startListening = useCallback(() => {
    setState(prev => ({
      ...prev,
      isListening: true,
      talkState: 'listening',
    }))

    // TODO: Integrate with actual speech-to-text
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        isListening: false,
        talkState: 'processing',
        inputText: 'Voice input will be integrated with speech-to-text.',
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
    if (!state.sessionId) return

    setState(prev => ({
      ...prev,
      isLoading: true,
    }))

    try {
      await loadChatHistory(state.sessionId)
      setState(prev => ({
        ...prev,
        isLoading: false,
      }))
    } catch {
      setState(prev => ({
        ...prev,
        isLoading: false,
      }))
      onError?.('Failed to refresh conversation')
    }
  }, [state.sessionId, onError])

  const setSessionId = useCallback((sessionId: string) => {
    setState(prev => ({ ...prev, sessionId }))
  }, [])

  return {
    ...state,
    sendMessage,
    setInputText,
    startListening,
    stopListening,
    refreshConversation,
    setSessionId,
  }
}
