// Services index file - exports all core services

export * from './chat/ChatService'
export * from './retrieval/RetrievalService'
export { 
  PersonaServiceImpl
} from './persona/PersonaService'
export type { StyleExtractor } from './persona/PersonaService'
export * from './persona/DatabasePersonaRepository'
export * from './llm/LLMGateway'
export * from './voice/VoiceIntegrationService'

// Service factory for dependency injection
export class ServiceFactory {
  private static chatService: ChatService | null = null
  private static retrievalService: RetrievalServiceImpl | null = null
  private static personaService: PersonaServiceImpl | null = null
  private static llmGateway: LLMGatewayImpl | null = null
  private static voiceIntegrationService: VoiceIntegrationServiceImpl | null = null

  static getChatService(): ChatServiceType {
    if (!this.chatService) {
      this.chatService = new ChatServiceImpl(
        new ChatRepositoryImpl(),
        this.getRetrievalService(),
        this.getPersonaService(),
        this.getLLMGateway()
      )
    }
    return this.chatService
  }

  static getRetrievalService(): RetrievalServiceImpl {
    if (!this.retrievalService) {
      this.retrievalService = new RetrievalServiceImpl()
    }
    return this.retrievalService
  }

  static getPersonaService(): PersonaServiceImpl {
    if (!this.personaService) {
      // Use database repository instead of in-memory
      this.personaService = new PersonaServiceImpl(
        new DatabasePersonaRepository(prisma),
        new StyleExtractorImpl(this.getLLMGateway()),
        new DocumentRepositoryImpl()
      )
    }
    return this.personaService
  }

  static getLLMGateway(): LLMGatewayImpl {
    if (!this.llmGateway) {
      this.llmGateway = new LLMGatewayImpl()
    }
    return this.llmGateway
  }

  static getVoiceIntegrationService(): VoiceIntegrationServiceImpl {
    if (!this.voiceIntegrationService) {
      this.voiceIntegrationService = new VoiceIntegrationServiceImpl()
    }
    return this.voiceIntegrationService
  }

  // Reset all services (useful for testing)
  static reset(): void {
    this.chatService = null
    this.retrievalService = null
    this.personaService = null
    this.llmGateway = null
    this.voiceIntegrationService = null
  }
}

// Import implementations
import { ChatService, ChatServiceImpl, ChatRepository } from './chat/ChatService'
import type { ChatService as ChatServiceType } from './chat/ChatService'
import { RetrievalServiceImpl, DocumentRepository, DocumentRepositoryImpl } from './retrieval/RetrievalService'
import { PersonaServiceImpl, StyleExtractor } from './persona/PersonaService'
import { StyleExtractorImpl } from './persona/StyleExtractor'
import { DatabasePersonaRepository } from './persona/DatabasePersonaRepository'
import { LLMGatewayImpl } from './llm/LLMGateway'
import { VoiceIntegrationService, VoiceIntegrationServiceImpl } from './voice/VoiceIntegrationService'
import { prisma } from '@/lib/prisma'
import type { ChatSession, ChatMessage } from '@/types'

// Create a simple ChatRepository implementation for now
class ChatRepositoryImpl implements ChatRepository {
  // In-memory storage for development - replace with database implementation
  private sessions: Map<string, ChatSession> = new Map()
  private messages: Map<string, ChatMessage[]> = new Map()

  async createSession(session: ChatSession): Promise<ChatSession> {
    this.sessions.set(session.id, session)
    return session
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    return this.sessions.get(sessionId) || null
  }

  async updateSession(session: ChatSession): Promise<ChatSession> {
    this.sessions.set(session.id, session)
    return session
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
    this.messages.delete(sessionId)
  }

  async listSessions(workspaceId: string, userId: string): Promise<ChatSession[]> {
    return Array.from(this.sessions.values())
      .filter(session => session.workspaceId === workspaceId && session.userId === userId)
  }

  async addMessage(message: ChatMessage): Promise<ChatMessage> {
    const sessionMessages = this.messages.get(message.sessionId) || []
    sessionMessages.push(message)
    this.messages.set(message.sessionId, sessionMessages)
    return message
  }

  async getMessages(sessionId: string, limit?: number, offset?: number): Promise<ChatMessage[]> {
    const messages = this.messages.get(sessionId) || []
    const start = offset || 0
    const end = limit ? start + limit : undefined
    return messages.slice(start, end)
  }
}
