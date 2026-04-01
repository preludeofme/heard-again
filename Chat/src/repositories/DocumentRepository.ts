import { DocumentRepository, Document, DocumentChunk } from '@/types/retrieval'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export class PrismaDocumentRepository implements DocumentRepository {
  async getDocument(documentId: string): Promise<Document | null> {
    const dbDocument = await (prisma as any).document.findUnique({
      where: { id: documentId }
    })

    if (!dbDocument) return null

    return this.mapDbDocumentToDocument(dbDocument)
  }

  async getChunk(chunkId: string): Promise<DocumentChunk | null> {
    const dbChunk = await (prisma as any).documentChunk.findUnique({
      where: { id: chunkId }
    })

    if (!dbChunk) return null

    return this.mapDbChunkToDocumentChunk(dbChunk)
  }

  async createDocument(document: Document): Promise<Document> {
    const dbDocument = await (prisma as any).document.create({
      data: {
        id: document.id,
        workspaceId: document.workspaceId,
        title: document.title,
        documentType: document.documentType,
        source: document.source,
        metadata: document.metadata
      }
    })

    return this.mapDbDocumentToDocument(dbDocument)
  }

  async updateDocument(document: Document): Promise<Document> {
    const dbDocument = await (prisma as any).document.update({
      where: { id: document.id },
      data: {
        title: document.title,
        documentType: document.documentType,
        source: document.source,
        metadata: document.metadata,
        updatedAt: new Date()
      }
    })

    return this.mapDbDocumentToDocument(dbDocument)
  }

  async deleteDocument(documentId: string): Promise<void> {
    await (prisma as any).document.delete({
      where: { id: documentId }
    })
  }

  async listDocuments(workspaceId: string, filters?: any): Promise<Document[]> {
    const whereClause: any = { workspaceId }
    
    if (filters) {
      if (filters.personId) {
        whereClause.personId = filters.personId
      }
      if (filters.documentType) {
        whereClause.documentType = filters.documentType
      }
    }

    const dbDocuments = await (prisma as any).document.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    })

    return dbDocuments.map(this.mapDbDocumentToDocument)
  }

  async createChunk(chunk: DocumentChunk): Promise<DocumentChunk> {
    const dbChunk = await (prisma as any).documentChunk.create({
      data: {
        id: chunk.id,
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        metadata: chunk.metadata,
        embedding: chunk.embedding,
        embeddingModel: chunk.embeddingModel
      }
    })

    return this.mapDbChunkToDocumentChunk(dbChunk)
  }

  async updateChunk(chunk: DocumentChunk): Promise<DocumentChunk> {
    const dbChunk = await (prisma as any).documentChunk.update({
      where: { id: chunk.id },
      data: {
        content: chunk.content,
        metadata: chunk.metadata,
        embedding: chunk.embedding,
        embeddingModel: chunk.embeddingModel
      }
    })

    return this.mapDbChunkToDocumentChunk(dbChunk)
  }

  async deleteChunk(chunkId: string): Promise<void> {
    await (prisma as any).documentChunk.delete({
      where: { id: chunkId }
    })
  }

  async getDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
    const dbChunks = await (prisma as any).documentChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: 'asc' }
    })

    return dbChunks.map(this.mapDbChunkToDocumentChunk)
  }

  private mapDbDocumentToDocument(dbDocument: any): Document {
    return {
      id: dbDocument.id,
      workspaceId: dbDocument.workspaceId,
      personId: dbDocument.personId,
      title: dbDocument.title,
      content: dbDocument.content || '',
      documentType: dbDocument.documentType.toLowerCase() as any,
      source: dbDocument.source,
      metadata: dbDocument.metadata,
      status: dbDocument.status?.toLowerCase() as any || 'uploaded',
      embeddingStatus: dbDocument.embeddingStatus?.toLowerCase() as any || 'pending',
      createdAt: dbDocument.createdAt,
      updatedAt: dbDocument.updatedAt
    }
  }

  private mapDbChunkToDocumentChunk(dbChunk: any): DocumentChunk {
    return {
      id: dbChunk.id,
      documentId: dbChunk.documentId,
      chunkIndex: dbChunk.chunkIndex,
      content: dbChunk.content,
      metadata: dbChunk.metadata,
      embedding: dbChunk.embedding,
      embeddingModel: dbChunk.embeddingModel,
      createdAt: dbChunk.createdAt
    }
  }
}
