import { ChatRepository } from '@/services/chat/ChatService'
import { ChatSession, ChatMessage } from '@/types/chat'
import { prisma } from '@/lib/prisma'

export class PrismaChatRepository implements ChatRepository {
  async createSession(session: ChatSession): Promise<ChatSession> {
    const dbSession = await (prisma as any).chatSession.create({
      data: {
        id: session.id,
        workspaceId: session.workspaceId,
        personId: session.personId,
        userId: session.userId,
        title: session.title,
        status: session.status.toUpperCase(),
        metadata: session.metadata
      }
    })

    return this.mapDbSessionToChatSession(dbSession)
  }

  async getSession(sessionId: string, userId?: string, workspaceId?: string): Promise<ChatSession | null> {
    const dbSession = await (prisma as any).chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!dbSession) return null

    // Ownership check — surface as null (404) to prevent enumeration
    if (userId && dbSession.userId !== userId) return null
    if (workspaceId && dbSession.workspaceId !== workspaceId) return null

    return this.mapDbSessionToChatSession(dbSession)
  }

  async updateSession(session: ChatSession): Promise<ChatSession> {
    const dbSession = await (prisma as any).chatSession.update({
      where: { id: session.id },
      data: {
        title: session.title,
        status: session.status.toUpperCase(),
        metadata: session.metadata,
        updatedAt: new Date()
      }
    })

    return this.mapDbSessionToChatSession(dbSession)
  }

  async deleteSession(sessionId: string): Promise<void> {
    await (prisma as any).chatSession.delete({
      where: { id: sessionId }
    })
  }

  async listSessions(workspaceId: string, userId: string): Promise<ChatSession[]> {
    const dbSessions = await (prisma as any).chatSession.findMany({
      where: {
        workspaceId,
        userId,
        status: 'ACTIVE'
      },
      orderBy: { updatedAt: 'desc' }
    })

    return dbSessions.map(this.mapDbSessionToChatSession)
  }

  async addMessage(message: ChatMessage): Promise<ChatMessage> {
    const dbMessage = await (prisma as any).chatMessage.create({
      data: {
        id: message.id,
        sessionId: message.sessionId,
        role: message.role.toUpperCase(),
        content: message.content,
        metadata: message.metadata
      }
    })

    return this.mapDbMessageToChatMessage(dbMessage)
  }

  async updateMessage(messageId: string, content: string, metadata?: any): Promise<ChatMessage | null> {
    const existing = await (prisma as any).chatMessage.findUnique({ where: { id: messageId } })
    if (!existing) return null

    const dbMessage = await (prisma as any).chatMessage.update({
      where: { id: messageId },
      data: {
        content,
        metadata: metadata ?? existing.metadata
      }
    })

    return this.mapDbMessageToChatMessage(dbMessage)
  }

  async getMessages(sessionId: string, limit = 50, offset = 0, userId?: string, workspaceId?: string): Promise<ChatMessage[]> {
    // Verify session ownership before returning messages
    if (userId || workspaceId) {
      const session = await this.getSession(sessionId, userId, workspaceId)
      if (!session) return []
    }

    const dbMessages = await (prisma as any).chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset
    })

    return dbMessages.map(this.mapDbMessageToChatMessage)
  }

  private mapDbSessionToChatSession(dbSession: any): ChatSession {
    return {
      id: dbSession.id,
      workspaceId: dbSession.workspaceId,
      personId: dbSession.personId,
      userId: dbSession.userId,
      title: dbSession.title,
      status: dbSession.status.toLowerCase() as any,
      metadata: dbSession.metadata,
      createdAt: dbSession.createdAt,
      updatedAt: dbSession.updatedAt
    }
  }

  private mapDbMessageToChatMessage(dbMessage: any): ChatMessage {
    return {
      id: dbMessage.id,
      sessionId: dbMessage.sessionId,
      role: dbMessage.role.toLowerCase() as any,
      content: dbMessage.content,
      metadata: dbMessage.metadata,
      createdAt: dbMessage.createdAt
    }
  }
}
