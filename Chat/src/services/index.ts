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
  private static chatService: ChatServiceType | null = null
  private static retrievalService: RetrievalServiceImpl | null = null
  private static personaService: PersonaServiceImpl | null = null
  private static llmGateway: LLMGatewayImpl | null = null
  private static voiceIntegrationService: VoiceIntegrationServiceImpl | null = null
  private static personService: PersonService | null = null

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
        new PrismaDocumentRepository(),
        this.getPersonService()
      )
    }
    return this.personaService
  }

  static getPersonService(): PersonService {
    if (!this.personService) {
      this.personService = new PersonService()
    }
    return this.personService
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
import { RetrievalServiceImpl } from './retrieval/RetrievalService'
import { PersonaServiceImpl, StyleExtractor } from './persona/PersonaService'
import { StyleExtractorImpl } from './persona/StyleExtractor'
import { DatabasePersonaRepository } from './persona/DatabasePersonaRepository'
import { LLMGatewayImpl } from './llm/LLMGateway'
import { VoiceIntegrationService, VoiceIntegrationServiceImpl } from './voice/VoiceIntegrationService'
import { prisma } from '@/lib/prisma'
import type { ChatSession, ChatMessage } from '@/types'
import { PrismaDocumentRepository } from '@/repositories/DocumentRepository'

// Use PrismaChatRepository for persistence
import { PrismaChatRepository } from '@/repositories/ChatRepository'
import { PersonService } from '@/services/persona/PersonService'

// Create a simple ChatRepository implementation for now
class ChatRepositoryImpl implements ChatRepository {
  async createSession(session: ChatSession): Promise<ChatSession> {
    const prismaRepo = new PrismaChatRepository()
    return await prismaRepo.createSession(session)
  }

  async getSession(sessionId: string, userId?: string, workspaceId?: string): Promise<ChatSession | null> {
    const prismaRepo = new PrismaChatRepository()
    return await prismaRepo.getSession(sessionId, userId, workspaceId)
  }

  async updateSession(session: ChatSession): Promise<ChatSession> {
    const prismaRepo = new PrismaChatRepository()
    return await prismaRepo.updateSession(session)
  }

  async deleteSession(sessionId: string): Promise<void> {
    const prismaRepo = new PrismaChatRepository()
    return await prismaRepo.deleteSession(sessionId)
  }

  async listSessions(workspaceId: string, userId: string): Promise<ChatSession[]> {
    const prismaRepo = new PrismaChatRepository()
    return await prismaRepo.listSessions(workspaceId, userId)
  }

  async addMessage(message: ChatMessage): Promise<ChatMessage> {
    const prismaRepo = new PrismaChatRepository()
    return await prismaRepo.addMessage(message)
  }

  async getMessages(sessionId: string, limit?: number, offset?: number): Promise<ChatMessage[]> {
    const prismaRepo = new PrismaChatRepository()
    return await prismaRepo.getMessages(sessionId, limit, offset)
  }

  async updateMessage(messageId: string, content: string, metadata?: any): Promise<ChatMessage | null> {
    const prismaRepo = new PrismaChatRepository()
    return await prismaRepo.updateMessage(messageId, content, metadata)
  }
}
