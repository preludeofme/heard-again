import { ChatSession, ChatMessage, ChatResponse, CreateSessionRequest, SendMessageRequest, StreamChunk } from '@/types'
import { v4 as uuidv4 } from 'uuid'
import { PromptBuilderImpl } from './PromptBuilder'

export interface ChatService {
  createSession(request: CreateSessionRequest): Promise<ChatSession>
  sendMessage(request: SendMessageRequest): Promise<ChatResponse>
  streamResponse(request: SendMessageRequest): Promise<AsyncIterable<StreamChunk>>
  getHistory(sessionId: string, limit?: number, offset?: number): Promise<ChatMessage[]>
  getSession(sessionId: string): Promise<ChatSession | null>
  updateSession(sessionId: string, updates: Partial<ChatSession>): Promise<ChatSession>
  deleteSession(sessionId: string): Promise<void>
  listSessions(workspaceId: string, userId: string): Promise<ChatSession[]>
  storeUserMessage(sessionId: string, message: string): Promise<ChatMessage>
  updateAssistantMessage(messageId: string, content: string, metadata?: any): Promise<ChatMessage>
}

export class ChatServiceImpl implements ChatService {
  constructor(
    private chatRepository: ChatRepository,
    private retrievalService: RetrievalService,
    private personaService: PersonaService,
    private llmGateway: LLMGateway,
    private promptBuilder: PromptBuilderImpl = new PromptBuilderImpl()
  ) {}

  async createSession(request: CreateSessionRequest): Promise<ChatSession> {
    const session: ChatSession = {
      id: uuidv4(),
      workspaceId: request.workspaceId,
      personId: request.personId,
      userId: request.userId,
      title: request.title,
      status: 'active',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }

    return await this.chatRepository.createSession(session)
  }

  async sendMessage(request: SendMessageRequest): Promise<ChatResponse> {
    const startTime = Date.now()

    // Get session
    const session = await this.chatRepository.getSession(request.sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    // Get persona profile
    const personaProfile = await this.personaService.getPersonaProfile(session.personId)
    if (!personaProfile) {
      throw new Error('Persona profile not found')
    }

    // Store user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      sessionId: request.sessionId,
      role: 'user',
      content: request.message,
      metadata: {},
      createdAt: new Date()
    }

    await this.chatRepository.addMessage(userMessage)

    // Retrieve relevant documents
    const retrievedDocuments = await this.retrievalService.searchDocuments(
      request.message,
      {
        workspaceId: session.workspaceId,
        personId: session.personId
      }
    )

    // Build prompt
    const prompt = await this.promptBuilder.buildPrompt(
      personaProfile,
      retrievedDocuments,
      request.message,
      await this.getHistory(request.sessionId, 10)
    )

    // Generate response
    const llmResponse = await this.llmGateway.generateResponse(prompt)

    // Store assistant message
    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      sessionId: request.sessionId,
      role: 'assistant',
      content: llmResponse.content,
      metadata: {
        processingTime: Date.now() - startTime,
        retrievedDocuments: retrievedDocuments,
        tokenCount: llmResponse.metadata.totalTokens
      },
      createdAt: new Date()
    }

    await this.chatRepository.addMessage(assistantMessage)

    return {
      message: assistantMessage,
      sessionId: request.sessionId,
      metadata: {
        processingTime: Date.now() - startTime,
        retrievedDocumentCount: retrievedDocuments.length,
        llmModel: llmResponse.metadata.model,
        tokensUsed: llmResponse.metadata.totalTokens
      }
    }
  }

  async getHistory(sessionId: string, limit?: number, offset?: number): Promise<ChatMessage[]> {
    const actualLimit = limit ?? 50
    const actualOffset = offset ?? 0
    return await this.chatRepository.getMessages(sessionId, actualLimit, actualOffset)
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    return await this.chatRepository.getSession(sessionId)
  }

  async updateSession(sessionId: string, updates: Partial<ChatSession>): Promise<ChatSession> {
    const session = await this.chatRepository.getSession(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: new Date()
    }

    return await this.chatRepository.updateSession(updatedSession)
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.chatRepository.deleteSession(sessionId)
  }

  async listSessions(workspaceId: string, userId: string): Promise<ChatSession[]> {
    return await this.chatRepository.listSessions(workspaceId, userId)
  }

  async streamResponse(request: SendMessageRequest): Promise<AsyncIterable<StreamChunk>> {
    const startTime = Date.now()

    // Get session
    const session = await this.chatRepository.getSession(request.sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    // Get persona profile
    const personaProfile = await this.personaService.getPersonaProfile(session.personId)
    if (!personaProfile) {
      throw new Error('Persona profile not found')
    }

    // Retrieve relevant documents
    const retrievedDocuments = await this.retrievalService.searchDocuments(
      request.message,
      {
        workspaceId: session.workspaceId,
        personId: session.personId
      }
    )

    // Build prompt
    const prompt = await this.promptBuilder.buildPrompt(
      personaProfile,
      retrievedDocuments,
      request.message,
      await this.getHistory(request.sessionId, 10)
    )

    // Generate streaming response
    const messageId = uuidv4()
    
    return this.createStreamGenerator(messageId, prompt, startTime, retrievedDocuments)
  }

  async storeUserMessage(sessionId: string, message: string): Promise<ChatMessage> {
    const userMessage: ChatMessage = {
      id: uuidv4(),
      sessionId,
      role: 'user',
      content: message,
      metadata: {},
      createdAt: new Date()
    }

    return await this.chatRepository.addMessage(userMessage)
  }

  async updateAssistantMessage(messageId: string, content: string, metadata?: any): Promise<ChatMessage> {
    // This would typically update the message in the database
    // For now, we'll return the updated message object
    const updatedMessage: ChatMessage = {
      id: messageId,
      sessionId: '', // Would be fetched from database
      role: 'assistant',
      content,
      metadata: metadata || {},
      createdAt: new Date()
    }

    return updatedMessage
  }

  private async* createStreamGenerator(
    messageId: string,
    prompt: CompiledPrompt,
    startTime: number,
    retrievedDocuments: RetrievedDocument[]
  ): AsyncIterable<StreamChunk> {
    try {
      // Store initial user message
      yield {
        type: 'start',
        messageId,
        metadata: {
          startTime,
          retrievedDocumentCount: retrievedDocuments.length
        }
      }

      // Generate streaming response
      const stream = await this.llmGateway.streamResponse(prompt)

      for await (const chunk of stream) {
        yield {
          type: 'chunk',
          messageId,
          content: chunk,
          metadata: {
            processingTime: Date.now() - startTime
          }
        }
      }

      // Final chunk
      yield {
        type: 'end',
        messageId,
        metadata: {
          totalProcessingTime: Date.now() - startTime,
          totalTokens: 0 // Would be calculated from stream chunks
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          processingTime: Date.now() - startTime
        }
      }
    }
  }

  private async buildPrompt(
    personaProfile: PersonaProfile,
    retrievedDocuments: RetrievedDocument[],
    userMessage: string,
    chatHistory: ChatMessage[]
  ): Promise<CompiledPrompt> {
    return await this.promptBuilder.buildPrompt(
      personaProfile,
      retrievedDocuments,
      userMessage,
      chatHistory
    )
  }

  private formatContext(documents: RetrievedDocument[]): string {
    return documents
      .map((doc, index) => {
        return `[Document ${index + 1}]: ${doc.metadata.title}\n${doc.content}`
      })
      .join('\n\n')
  }
}

// Repository interface for data access
export interface ChatRepository {
  createSession(session: ChatSession): Promise<ChatSession>
  getSession(sessionId: string): Promise<ChatSession | null>
  updateSession(session: ChatSession): Promise<ChatSession>
  deleteSession(sessionId: string): Promise<void>
  listSessions(workspaceId: string, userId: string): Promise<ChatSession[]>
  addMessage(message: ChatMessage): Promise<ChatMessage>
  getMessages(sessionId: string, limit?: number, offset?: number): Promise<ChatMessage[]>
}

// Import types (these will be resolved when we implement the other services)
import type { RetrievedDocument } from '@/types/retrieval'
import type { PersonaProfile } from '@/types/persona'
import type { CompiledPrompt } from '@/types/llm'
import type { RetrievalService } from '@/types/retrieval'
import type { PersonaService } from '@/types/persona'
import type { LLMGateway } from '@/types/llm'

// Import actual implementations for the ServiceFactory to work
import { RetrievalServiceImpl } from '../retrieval/RetrievalService'
import { PersonaServiceImpl } from '../persona/PersonaService'
import { LLMGatewayImpl } from '../llm/LLMGateway'
