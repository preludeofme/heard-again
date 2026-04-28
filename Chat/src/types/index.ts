// Main types index file - exports all types and resolves circular dependencies

// Core types
export * from './chat'
export * from './persona'
export * from './retrieval'
export * from './llm'
export * from './ingestion'

// Import types for interface definitions
import type { PersonaProfile } from './persona'
import type { RetrievedDocument, SearchContext } from './retrieval'
import type {
  ChatMessage,
  EvidencePacket,
  EvidenceThresholds,
  ResponseCitation,
  ResponseValidationSummary,
  StrictAssistantEnvelope,
  StrictChatResponse,
} from './chat'
import type { CompiledPrompt } from './llm'

// Common utility types
export interface PromptBuilder {
  buildPrompt(
    personaProfile: PersonaProfile,
    retrievedDocuments: RetrievedDocument[],
    userMessage: string,
    chatHistory: ChatMessage[]
  ): Promise<CompiledPrompt>
}

export interface EvidenceGate {
  buildEvidencePacket(
    query: string,
    context: SearchContext,
    retrievedDocuments: RetrievedDocument[],
    thresholds?: Partial<EvidenceThresholds>
  ): EvidencePacket

  toCitations(packet: EvidencePacket, limit?: number): ResponseCitation[]
}

export interface StrictPromptCompiler {
  compileStrictPrompt(input: {
    personaProfile: PersonaProfile
    evidencePacket: EvidencePacket
    userMessage: string
    chatHistory: ChatMessage[]
  }): Promise<CompiledPrompt>
}

export interface StrictResponseValidator {
  validateEnvelope(input: {
    envelope: StrictAssistantEnvelope
    evidencePacket: EvidencePacket
    knownFacts: string[]
  }): Promise<ResponseValidationSummary>
}

export interface StrictChatOrchestrator {
  sendMessageStrict(sessionId: string, message: string): Promise<StrictChatResponse>
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: ApiError
  metadata?: {
    timestamp: Date
    requestId: string
    version: string
  }
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
  stack?: string
}

export interface PaginationOptions {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface FamilyspaceContext {
  familyspaceId: string
  userId: string
  permissions: string[]
  role: 'owner' | 'admin' | 'member' | 'viewer'
}

export interface ServiceConfig {
  database: {
    url: string
    maxConnections: number
  }
  redis: {
    url: string
    maxRetries: number
  }
  ollama: {
    baseUrl: string
    defaultModel: string
    embeddingModel: string
  }
  chroma: {
    url: string
    credentials: string
  }
  security: {
    jwtSecret: string
    sessionSecret: string
  }
  logging: {
    level: string
    file: string
  }
}
