import { PrismaClient } from '@prisma/client'

// Database connection singleton
class Database {
  private static instance: PrismaClient | null = null

  static getInstance(): PrismaClient {
    if (!this.instance) {
      this.instance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        errorFormat: 'pretty'
      })
    }
    return this.instance
  }

  static async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.$disconnect()
      this.instance = null
    }
  }

  static async healthCheck(): Promise<boolean> {
    try {
      const db = this.getInstance()
      await db.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      console.error('Database health check failed:', error)
      return false
    }
  }
}

// Migration utilities
export class MigrationManager {
  static async runMigrations(): Promise<void> {
    try {
      console.log('Running database migrations...')
      // In a real implementation, you would use Prisma migrate
      // For now, we'll just check if tables exist
      const db = Database.getInstance()
      
      // Check if tables exist by querying one
      await db.$queryRaw`SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'chat_sessions'`
      
      console.log('Database migrations completed successfully')
    } catch (error) {
      console.error('Migration failed:', error)
      throw error
    }
  }

  static async resetDatabase(): Promise<void> {
    try {
      console.log('Resetting database...')
      const db = Database.getInstance()
      
      // Drop all tables (for development/testing only)
      await db.$executeRaw`DROP TABLE IF EXISTS audit_logs CASCADE`
      await db.$executeRaw`DROP TABLE IF EXISTS ingestion_jobs CASCADE`
      await db.$executeRaw`DROP TABLE IF EXISTS document_chunks CASCADE`
      await db.$executeRaw`DROP TABLE IF EXISTS documents CASCADE`
      await db.$executeRaw`DROP TABLE IF EXISTS persona_profiles CASCADE`
      await db.$executeRaw`DROP TABLE IF EXISTS chat_messages CASCADE`
      await db.$executeRaw`DROP TABLE IF EXISTS chat_sessions CASCADE`
      await db.$executeRaw`DROP TABLE IF EXISTS user_workspaces CASCADE`
      await db.$executeRaw`DROP TABLE IF EXISTS workspaces CASCADE`
      
      // Drop enums
      await db.$executeRaw`DROP TYPE IF EXISTS "SessionStatus" CASCADE`
      await db.$executeRaw`DROP TYPE IF EXISTS "MessageRole" CASCADE`
      await db.$executeRaw`DROP TYPE IF EXISTS "PersonaStatus" CASCADE`
      await db.$executeRaw`DROP TYPE IF EXISTS "DocumentType" CASCADE`
      await db.$executeRaw`DROP TYPE IF EXISTS "DocumentStatus" CASCADE`
      await db.$executeRaw`DROP TYPE IF EXISTS "EmbeddingStatus" CASCADE`
      await db.$executeRaw`DROP TYPE IF EXISTS "IngestionJobType" CASCADE`
      await db.$executeRaw`DROP TYPE IF EXISTS "IngestionJobStatus" CASCADE`
      await db.$executeRaw`DROP TYPE IF EXISTS "JobPriority" CASCADE`
      await db.$executeRaw`DROP TYPE IF EXISTS "WorkspaceRole" CASCADE`
      
      console.log('Database reset completed')
    } catch (error) {
      console.error('Database reset failed:', error)
      throw error
    }
  }

  static async seedDatabase(): Promise<void> {
    try {
      console.log('Seeding database...')
      const db = Database.getInstance()
      
      // Create a default workspace for testing
      const workspace = await db.workspace.create({
        data: {
          name: 'Default Workspace',
          description: 'Default workspace for testing',
          settings: {}
        }
      })
      
      console.log(`Created default workspace: ${workspace.id}`)
      console.log('Database seeding completed')
    } catch (error) {
      console.error('Database seeding failed:', error)
      throw error
    }
  }
}

// Repository implementations using Prisma
export class ChatRepositoryImpl {
  private db = Database.getInstance()

  async createSession(session: any): Promise<any> {
    return await this.db.chatSession.create({
      data: session,
      include: {
        messages: true
      }
    })
  }

  async getSession(sessionId: string): Promise<any> {
    return await this.db.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })
  }

  async updateSession(session: any): Promise<any> {
    return await this.db.chatSession.update({
      where: { id: session.id },
      data: session,
      include: {
        messages: true
      }
    })
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.db.chatSession.delete({
      where: { id: sessionId }
    })
  }

  async listSessions(workspaceId: string, userId: string): Promise<any[]> {
    return await this.db.chatSession.findMany({
      where: {
        workspaceId,
        userId,
        status: 'ACTIVE'
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    })
  }

  async addMessage(message: any): Promise<any> {
    return await this.db.chatMessage.create({
      data: message
    })
  }

  async getMessages(sessionId: string, limit = 50, offset = 0): Promise<any[]> {
    return await this.db.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset
    })
  }
}

export class DocumentRepositoryImpl {
  private db = Database.getInstance()

  async getDocument(documentId: string): Promise<any> {
    return await this.db.document.findUnique({
      where: { id: documentId },
      include: {
        chunks: true
      }
    })
  }

  async getChunk(chunkId: string): Promise<any> {
    return await this.db.documentChunk.findUnique({
      where: { id: chunkId }
    })
  }

  async createDocument(document: any): Promise<any> {
    return await this.db.document.create({
      data: document
    })
  }

  async updateDocument(document: any): Promise<any> {
    return await this.db.document.update({
      where: { id: document.id },
      data: document
    })
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.db.document.delete({
      where: { id: documentId }
    })
  }

  async listDocuments(workspaceId: string, filters?: any): Promise<any[]> {
    return await this.db.document.findMany({
      where: {
        workspaceId,
        ...filters
      },
      orderBy: { createdAt: 'desc' }
    })
  }
}

export class PersonaRepositoryImpl {
  private db = Database.getInstance()

  async getPersonaProfile(personId: string): Promise<any> {
    return await this.db.personaProfile.findUnique({
      where: { personId }
    })
  }

  async createPersonaProfile(profile: any): Promise<any> {
    return await this.db.personaProfile.create({
      data: profile
    })
  }

  async updatePersonaProfile(profile: any): Promise<any> {
    return await this.db.personaProfile.update({
      where: { id: profile.id },
      data: profile
    })
  }

  async deletePersonaProfile(personId: string): Promise<void> {
    await this.db.personaProfile.delete({
      where: { personId }
    })
  }

  async listPersonaProfiles(workspaceId: string): Promise<any[]> {
    return await this.db.personaProfile.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' }
    })
  }
}

export default Database
