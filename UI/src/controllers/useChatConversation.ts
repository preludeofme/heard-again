import { useCallback, useEffect, useState, useRef } from 'react'
import { ConversationMessage } from '@/types'
import { fetchWithCSRF } from '@/lib/api-client'

type TalkState = 'idle' | 'listening' | 'typing' | 'processing'

interface SessionSummary {
  id: string
  personId: string
  title: string
  status: string
  createdAt: string
  updatedAt: string
}

interface ChatConversationState {
  messages: ConversationMessage[]
  inputText: string
  talkState: TalkState
  isLoading: boolean
  isListening: boolean
  sessionId?: string
  personaExists?: boolean
  personaConfidence?: number
  needsPersonaGeneration?: boolean
  sessions: SessionSummary[]
  isLoadingSessions: boolean
}

interface ChatConversationActions {
  sendMessage: () => Promise<void>
  setInputText: (text: string) => void
  startListening: () => void
  stopListening: () => void
  refreshConversation: () => Promise<void>
  setSessionId: (sessionId: string) => void
  generatePersona: () => Promise<void>
  checkPersonaExists: () => Promise<{ exists: boolean; confidence?: number }>
  loadSessions: () => Promise<void>
  switchSession: (sessionId: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
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
    sessions: [],
    isLoadingSessions: false,
  })

  // Speech recognition setup
  const recognitionRef = useRef<any>(null)
  
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = 'en-US'
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setState(prev => ({ 
          ...prev, 
          inputText: transcript,
          isListening: false,
          talkState: 'idle'
        }))
      }
      
      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setState(prev => ({ 
          ...prev, 
          isListening: false,
          talkState: 'idle'
        }))
        onError?.('Speech recognition failed. Please try again.')
      }
      
      recognitionRef.current.onend = () => {
        setState(prev => ({ 
          ...prev, 
          isListening: false,
          talkState: 'idle'
        }))
      }
    }
  }, [onError])

  // Initialize or get chat session when subjectId changes
  useEffect(() => {
    if (subjectId) {
      initializeChatSession()
    }
  }, [subjectId])

  const initializeChatSession = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }))
      
      // First check if persona exists — use returned value to avoid stale closure
      const personaStatus = await checkPersonaExists()
      
      if (!personaStatus.exists) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          needsPersonaGeneration: true 
        }))
        onError?.(`${subjectId}'s persona hasn't been built yet. Generate their persona to start chatting.`)
        return
      }
      
      // Check if persona has low confidence score
      if (personaStatus.confidence !== undefined && personaStatus.confidence < 0.3) {
        onError?.('Limited data available — responses may be less accurate.')
      }

      // Look for existing session with this person
      const existingSessions = await fetch('/api/chat/sessions', {
        method: 'GET',
        credentials: 'include',
      })

      if (existingSessions.ok) {
        const sessionsData = await existingSessions.json()
        if (sessionsData.success && sessionsData.sessions) {
          // Find a session with the same personId
          const existingSession = sessionsData.sessions.find((session: any) => session.personId === subjectId)
          
          if (existingSession) {
            // Verify the session is accessible before committing to it
            const testRes = await fetch(`/api/chat/messages?sessionId=${existingSession.id}`, {
              credentials: 'include',
            })
            if (testRes.ok) {
              setState(prev => ({ 
                ...prev, 
                sessionId: existingSession.id, 
                needsPersonaGeneration: false 
              }))
              const data = await testRes.json()
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
              setState(prev => ({ ...prev, isLoading: false }))
              return
            }
            // Session inaccessible — fall through to create a new one
          }
        }
      }

      // No existing session found, create a new one
      const response = await fetchWithCSRF('/api/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        setState(prev => ({ ...prev, sessionId: data.session.id, needsPersonaGeneration: false }))
        
        // Load existing messages if any
        await loadChatHistory(data.session.id)
      }
    } catch (error) {
      console.error('Failed to initialize chat session:', error)
      setState(prev => ({ ...prev, isLoading: false }))
      onError?.('Failed to start conversation')
    }
  }

  const loadChatHistory = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat/messages?sessionId=${sessionId}`, {
        headers: {},
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
      const response = await fetchWithCSRF('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      let sseBuffer = ''

      const processSseEvent = async (eventBlock: string) => {
        const lines = eventBlock
          .split('\n')
          .map((line) => line.trimEnd())
          .filter(Boolean)

        const dataLines = lines
          .filter((line) => line.startsWith('data: '))
          .map((line) => line.slice(6))

        if (dataLines.length === 0) {
          return
        }

        const data = JSON.parse(dataLines.join('\n'))

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
          return
        }

        if (data.type === 'chunk' && assistantMessage) {
          fullContent += data.content
          assistantMessage.content = fullContent

          setState(prev => ({
            ...prev,
            messages: prev.messages.map(msg =>
              msg.id === assistantMessage!.id ? assistantMessage! : msg
            ),
          }))
          return
        }

        if (data.type === 'end') {
          if (data.filteredContent && assistantMessage) {
            fullContent = data.filteredContent
            assistantMessage.content = fullContent

            setState(prev => ({
              ...prev,
              messages: prev.messages.map(msg =>
                msg.id === assistantMessage!.id ? assistantMessage! : msg
              ),
            }))
          }

          setState(prev => ({
            ...prev,
            isLoading: false,
            talkState: 'idle',
          }))

          if (onAssistantMessage && fullContent) {
            await onAssistantMessage(fullContent)
          }
          return
        }

        if (data.type === 'error') {
          throw new Error(data.error || 'Stream error')
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          // Flush any trailing buffered event block (no-op if incomplete/empty)
          if (sseBuffer.includes('\n\n')) {
            const events = sseBuffer.split('\n\n')
            sseBuffer = events.pop() || ''
            for (const eventBlock of events) {
              await processSseEvent(eventBlock)
            }
          }
          break
        }

        sseBuffer += decoder.decode(value, { stream: true })
        const events = sseBuffer.split('\n\n')
        sseBuffer = events.pop() || ''

        for (const eventBlock of events) {
          try {
            await processSseEvent(eventBlock)
          } catch (parseError) {
            console.error('Failed to parse chunk:', parseError)
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
    if (!recognitionRef.current) {
      onError?.('Speech recognition is not supported in your browser.')
      return
    }

    try {
      setState(prev => ({
        ...prev,
        isListening: true,
        talkState: 'listening',
      }))
      
      recognitionRef.current.start()
    } catch (error) {
      console.error('Failed to start speech recognition:', error)
      setState(prev => ({
        ...prev,
        isListening: false,
        talkState: 'idle',
      }))
      onError?.('Failed to start speech recognition.')
    }
  }, [onError])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && state.isListening) {
      try {
        recognitionRef.current.stop()
      } catch (error) {
        console.error('Failed to stop speech recognition:', error)
      }
    }
    
    setState(prev => ({
      ...prev,
      isListening: false,
      talkState: 'idle',
    }))
  }, [state.isListening])

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

  const loadSessions = useCallback(async () => {
    setState(prev => ({ ...prev, isLoadingSessions: true }))
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'GET',
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.sessions) {
          setState(prev => ({ ...prev, sessions: data.sessions, isLoadingSessions: false }))
        } else {
          setState(prev => ({ ...prev, isLoadingSessions: false }))
        }
      } else {
        setState(prev => ({ ...prev, isLoadingSessions: false }))
      }
    } catch (error) {
      console.error('Failed to load sessions:', error)
      setState(prev => ({ ...prev, isLoadingSessions: false }))
    }
  }, [])

  const switchSession = useCallback(async (sessionId: string) => {
    setState(prev => ({ ...prev, isLoading: true, messages: [], sessionId }))
    await loadChatHistory(sessionId)
    setState(prev => ({ ...prev, isLoading: false }))
  }, [])

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetchWithCSRF(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (response.ok) {
        setState(prev => ({
          ...prev,
          sessions: prev.sessions.filter(s => s.id !== sessionId),
          // If we deleted the active session, clear it
          sessionId: prev.sessionId === sessionId ? undefined : prev.sessionId,
          messages: prev.sessionId === sessionId ? [] : prev.messages,
        }))
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
      onError?.('Failed to delete conversation')
    }
  }, [onError])

  const checkPersonaExists = useCallback(async (): Promise<{ exists: boolean; confidence?: number }> => {
    if (!subjectId) return { exists: false }

    try {
      const response = await fetch(`/api/persona/${subjectId}`, {
        method: 'GET',
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setState(prev => ({
            ...prev,
            personaExists: true,
            personaConfidence: data.persona.confidenceScore,
            needsPersonaGeneration: false
          }))
          return { exists: true, confidence: data.persona.confidenceScore }
        }
      } else if (response.status === 404) {
        setState(prev => ({
          ...prev,
          personaExists: false,
          personaConfidence: undefined,
          needsPersonaGeneration: true
        }))
        return { exists: false }
      }
    } catch (error) {
      console.error('Failed to check persona existence:', error)
      setState(prev => ({
        ...prev,
        personaExists: false,
        personaConfidence: undefined,
        needsPersonaGeneration: true
      }))
    }
    return { exists: false }
  }, [subjectId])

  const generatePersona = useCallback(async () => {
    if (!subjectId) return

    setState(prev => ({ ...prev, isLoading: true }))

    try {
      const response = await fetchWithCSRF(`/api/persona/${subjectId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          options: {
            minDocumentCount: 3,
            extractStyle: true,
            extractFacts: true,
            extractRelationships: true,
          }
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate persona')
      }

      const data = await response.json()
      if (data.success) {
        setState(prev => ({
          ...prev,
          personaExists: true,
          personaConfidence: data.persona.confidenceScore,
          needsPersonaGeneration: false,
          isLoading: false
        }))

        // Now initialize the chat session
        await initializeChatSession()
      }
    } catch (error) {
      console.error('Failed to generate persona:', error)
      setState(prev => ({ ...prev, isLoading: false }))
      onError?.(error instanceof Error ? error.message : 'Failed to generate persona')
    }
  }, [subjectId, onError])

  return {
    ...state,
    sendMessage,
    setInputText,
    startListening,
    stopListening,
    refreshConversation,
    setSessionId,
    generatePersona,
    checkPersonaExists,
    loadSessions,
    switchSession,
    deleteSession,
  }
}
