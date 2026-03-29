import { 
  RetrievalService, 
  SearchContext, 
  RetrievedDocument, 
  Document, 
  DocumentChunk,
  DocumentType,
  SearchResult,
  SearchQuery
} from '@/types'
import { ChromaClient } from 'chromadb'

export class RetrievalServiceImpl implements RetrievalService {
  private chromaClient: ChromaClient
  private documentRepository: DocumentRepository

  constructor(
    chromaUrl: string = process.env.CHROMA_URL || 'http://localhost:8004'
  ) {
    this.chromaClient = new ChromaClient({ path: chromaUrl })
    this.documentRepository = new DocumentRepositoryImpl()
  }

  async searchDocuments(query: string, context: SearchContext): Promise<RetrievedDocument[]> {
    const collectionName = this.getCollectionName(context.workspaceId)
    
    try {
      const collection = await this.chromaClient.getCollection({
        name: collectionName
      })

      // Build metadata filters
      const whereFilters: any = {}
      if (context.personId) {
        whereFilters.personId = context.personId
      }
      if (context.documentTypes && context.documentTypes.length > 0) {
        whereFilters.documentType = { $in: context.documentTypes }
      }
      if (context.dateRange) {
        whereFilters.createdAt = {
          $gte: context.dateRange.start.getTime(),
          $lte: context.dateRange.end.getTime()
        }
      }

      // Query ChromaDB
      const results = await collection.query({
        queryTexts: [query],
        nResults: context.maxResults || 10,
        where: Object.keys(whereFilters).length > 0 ? whereFilters : undefined
      })

      // Convert to RetrievedDocument format
      const retrievedDocuments: RetrievedDocument[] = []
      
      if (results.ids[0] && results.documents[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const chunkId = results.ids[0][i]
          const content = results.documents[0][i]
          const metadata = results.metadatas?.[0]?.[i] || {}
          const distance = results.distances?.[0]?.[i] || 0

          // Get document information
          const document = await this.documentRepository.getDocument(metadata.documentId)
          if (!document) continue

          // Calculate relevance score (convert distance to similarity)
          const relevanceScore = 1 - (distance || 0)

          // Apply minimum relevance filter
          if (context.minRelevanceScore && relevanceScore < context.minRelevanceScore) {
            continue
          }

          retrievedDocuments.push({
            id: uuidv4(),
            documentId: metadata.documentId,
            chunkId,
            content,
            metadata: {
              title: document.title,
              source: document.source,
              pageNumber: metadata.pageNumber,
              chunkIndex: metadata.chunkIndex,
              totalChunks: metadata.totalChunks,
              personId: metadata.personId,
              documentType: metadata.documentType as DocumentType,
              relevanceScore,
              extractedAt: new Date(metadata.extractedAt || Date.now()),
              embeddingModel: metadata.embeddingModel || 'nomic-embed-text',
              chunkSize: metadata.chunkSize || 0,
              overlapSize: metadata.overlapSize || 0
            }
          })
        }
      }

      // Rank documents by relevance
      return retrievedDocuments.sort((a, b) => b.metadata.relevanceScore - a.metadata.relevanceScore)
    } catch (error) {
      console.error('Error searching documents:', error)
      throw new Error('Failed to search documents')
    }
  }

  async searchPersonaDocuments(
    personId: string, 
    query: string, 
    context?: SearchContext
  ): Promise<RetrievedDocument[]> {
    const searchContext: SearchContext = {
      ...context,
      personId
    }
    return await this.searchDocuments(query, searchContext)
  }

  async rankDocuments(documents: RetrievedDocument[], query: string): Promise<RetrievedDocument[]> {
    // For now, use the existing relevance scores
    // In a more sophisticated implementation, we could:
    // 1. Re-rank using a different model
    // 2. Apply semantic similarity scoring
    // 3. Consider user interaction history
    // 4. Apply diversity metrics

    return documents.sort((a, b) => b.metadata.relevanceScore - a.metadata.relevanceScore)
  }

  async getDocumentById(documentId: string): Promise<Document | null> {
    return await this.documentRepository.getDocument(documentId)
  }

  async getChunkById(chunkId: string): Promise<DocumentChunk | null> {
    return await this.documentRepository.getChunk(chunkId)
  }

  private getCollectionName(workspaceId: string): string {
    return `workspace_${workspaceId}_documents`
  }
}

// Repository interface for document data access
export interface DocumentRepository {
  getDocument(documentId: string): Promise<Document | null>
  getChunk(chunkId: string): Promise<DocumentChunk | null>
  createDocument(document: Document): Promise<Document>
  updateDocument(document: Document): Promise<Document>
  deleteDocument(documentId: string): Promise<void>
  listDocuments(workspaceId: string, filters?: any): Promise<Document[]>
}

export class DocumentRepositoryImpl implements DocumentRepository {
  // This would typically use Prisma or another ORM
  // For now, we'll implement a basic version

  async getDocument(documentId: string): Promise<Document | null> {
    // TODO: Implement database query
    // This would typically be:
    // return await prisma.document.findUnique({ where: { id: documentId } })
    throw new Error('Not implemented - database integration needed')
  }

  async getChunk(chunkId: string): Promise<DocumentChunk | null> {
    // TODO: Implement database query
    // return await prisma.documentChunk.findUnique({ where: { id: chunkId } })
    throw new Error('Not implemented - database integration needed')
  }

  async createDocument(document: Document): Promise<Document> {
    // TODO: Implement database query
    // return await prisma.document.create({ data: document })
    throw new Error('Not implemented - database integration needed')
  }

  async updateDocument(document: Document): Promise<Document> {
    // TODO: Implement database query
    // return await prisma.document.update({ where: { id: document.id }, data: document })
    throw new Error('Not implemented - database integration needed')
  }

  async deleteDocument(documentId: string): Promise<void> {
    // TODO: Implement database query
    // await prisma.document.delete({ where: { id: documentId } })
    throw new Error('Not implemented - database integration needed')
  }

  async listDocuments(workspaceId: string, filters?: any): Promise<Document[]> {
    // TODO: Implement database query
    // return await prisma.document.findMany({ where: { workspaceId, ...filters } })
    throw new Error('Not implemented - database integration needed')
  }
}

// Helper functions
import { v4 as uuidv4 } from 'uuid'
