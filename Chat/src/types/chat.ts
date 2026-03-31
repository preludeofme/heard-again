import type { PersonaProfile } from './persona'
import type { RetrievedDocument, SearchContext } from './retrieval'

// Core chat-related types for the Phase 1 Chat System

export enum DocumentType {
  STORY = 'story',
  LETTER = 'letter',
  DIARY = 'diary',
  PHOTO_CAPTION = 'photo_caption',
  AUDIO_TRANSCRIPT = 'audio_transcript',
  DOCUMENT = 'document',
  OTHER = 'other'
}

export interface ChatSession {
  id: string
  workspaceId: string
  personId: string
  userId: string
  title?: string
  status: 'active' | 'archived' | 'deleted'
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata: {
    retrievedDocuments?: RetrievedDocument[]
    personaProfile?: PersonaProfile
    processingTime?: number
    tokenCount?: number
  }
  createdAt: Date
}

export interface ChatResponse {
  message: ChatMessage
  sessionId: string
  metadata: {
    processingTime: number
    retrievedDocumentCount: number
    llmModel: string
    tokensUsed: number
  }
}

export interface CreateSessionRequest {
  workspaceId: string
  personId: string
  userId: string
  title?: string
}

export interface SendMessageRequest {
  sessionId: string
  message: string
  options?: {
    maxRetrievedDocuments?: number
    includePersonaStyle?: boolean
    temperature?: number
  }
}

export interface ChatHistoryOptions {
  sessionId: string
  limit?: number
  offset?: number
  includeSystemMessages?: boolean
}

export interface ChatStreamResponse {
  type: 'start' | 'chunk' | 'end' | 'error'
  data?: string
  metadata?: {
    sessionId: string
    messageId?: string
    processingTime?: number
  }
  error?: string
}

export interface StreamChunk {
  type: 'start' | 'chunk' | 'metadata' | 'end' | 'error'
  messageId?: string
  content?: string
  metadata?: any
  processingTime?: number
  tokensUsed?: number
  error?: string
}
