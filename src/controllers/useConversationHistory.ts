import { useState, useCallback, useEffect } from 'react'

interface Conversation {
  id: string
  personId: string
  personName: string
  personAvatar?: string
  lastMessage: string
  lastMessageTime: Date
  messageCount: number
  isActive: boolean
}

interface ConversationHistoryState {
  conversations: Conversation[]
  isLoading: boolean
}

interface ConversationHistoryActions {
  startConversation: (personId: string, personName: string, personAvatar?: string) => string
  endConversation: (conversationId: string) => void
  updateConversation: (conversationId: string, lastMessage: string) => void
  setActiveConversation: (conversationId: string) => void
  getActiveConversation: () => Conversation | null
}

export function useConversationHistory(): ConversationHistoryState & ConversationHistoryActions {
  const [state, setState] = useState<ConversationHistoryState>({
    conversations: [],
    isLoading: false,
  })

  // Load conversations from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('conversation-history')
      if (stored) {
        const parsed = JSON.parse(stored)
        setState({
          conversations: parsed.map((conv: any) => ({
            ...conv,
            lastMessageTime: new Date(conv.lastMessageTime)
          })),
          isLoading: false,
        })
      }
    } catch {
      // If loading fails, start with empty state
      setState({ conversations: [], isLoading: false })
    }
  }, [])

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    if (state.conversations.length > 0) {
      localStorage.setItem('conversation-history', JSON.stringify(state.conversations))
    }
  }, [state.conversations])

  const startConversation = useCallback((personId: string, personName: string, personAvatar?: string) => {
    const conversationId = `conv_${personId}_${Date.now()}`
    const newConversation: Conversation = {
      id: conversationId,
      personId,
      personName,
      personAvatar,
      lastMessage: 'Started a new conversation',
      lastMessageTime: new Date(),
      messageCount: 0,
      isActive: true,
    }

    setState(prev => ({
      ...prev,
      conversations: [
        // Set all other conversations as inactive
        ...prev.conversations.map(conv => ({ ...conv, isActive: false })),
        newConversation
      ]
    }))

    return conversationId
  }, [])

  const endConversation = useCallback((conversationId: string) => {
    setState(prev => ({
      ...prev,
      conversations: prev.conversations.filter(conv => conv.id !== conversationId)
    }))
  }, [])

  const updateConversation = useCallback((conversationId: string, lastMessage: string) => {
    setState(prev => ({
      ...prev,
      conversations: prev.conversations.map(conv => 
        conv.id === conversationId 
          ? {
              ...conv,
              lastMessage,
              lastMessageTime: new Date(),
              messageCount: conv.messageCount + 1
            }
          : conv
      )
    }))
  }, [])

  const setActiveConversation = useCallback((conversationId: string) => {
    setState(prev => ({
      ...prev,
      conversations: prev.conversations.map(conv => ({
        ...conv,
        isActive: conv.id === conversationId
      }))
    }))
  }, [])

  const getActiveConversation = useCallback(() => {
    return state.conversations.find(conv => conv.isActive) || null
  }, [state.conversations])

  return {
    ...state,
    startConversation,
    endConversation,
    updateConversation,
    setActiveConversation,
    getActiveConversation,
  }
}
