import type { PersonaProfile } from './persona'
import type { RetrievedDocument, SearchContext } from './retrieval'
export { DocumentType } from './retrieval'

// Core chat-related types for the Phase 1 Chat System

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

export type PersonaResponseMode =
  | 'FACT_SUPPORTED'
  | 'STORY_SUPPORTED'
  | 'QUOTE_SUPPORTED'
  | 'INSUFFICIENT_EVIDENCE'

export interface ResponseCitation {
  documentId: string
  chunkId: string
  title: string
  excerpt: string
  relevanceScore: number
}

export interface ValidationViolationSummary {
  type: string
  severity: 'low' | 'medium' | 'high'
  description: string
}

export interface ResponseValidationSummary {
  isValid: boolean
  violations: ValidationViolationSummary[]
}

export interface EvidenceThresholds {
  minTopScore: number
  minAvgTop3: number
  minSources: number
}

export interface EvidencePacketItem {
  documentId: string
  chunkId: string
  title: string
  content: string
  relevanceScore: number
  chunkIndex: number
  totalChunks: number
  source: string
}

export interface EvidencePacket {
  workspaceId: string
  personId: string
  query: string
  retrievedAt: Date
  topK: number
  items: EvidencePacketItem[]
  thresholds: EvidenceThresholds
  passed: boolean
}

export interface StrictAssistantEnvelope {
  mode: PersonaResponseMode
  answer: string
  citations: ResponseCitation[]
  confidence: number
  validation: ResponseValidationSummary
}

export interface StrictChatResponse extends ChatResponse {
  envelope: StrictAssistantEnvelope
  metadata: ChatResponse['metadata'] & {
    evidencePassed: boolean
    refusalApplied: boolean
    responseMode: PersonaResponseMode
  }
}
