// Main types index file - exports all types and resolves circular dependencies

// Core types
export * from './chat'
export * from './persona'
export * from './retrieval'
export * from './llm'
export * from './ingestion'

// Import types for interface definitions
import type { PersonaProfile } from './persona'
import type { RetrievedDocument } from './retrieval'
import type { ChatMessage } from './chat'
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

export interface WorkspaceContext {
  workspaceId: string
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
