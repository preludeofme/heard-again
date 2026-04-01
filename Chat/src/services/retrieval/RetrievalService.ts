import { 
  RetrievalService, 
  SearchContext, 
  RetrievedDocument, 
  Document, 
  DocumentChunk,
  DocumentType,
  DocumentRepository,
  SearchResult,
  SearchQuery
} from '@/types'
import { PrismaDocumentRepository } from '@/repositories/DocumentRepository'
import { ChromaClient, DefaultEmbeddingFunction } from 'chromadb'
import { v4 as uuidv4 } from 'uuid'

export class RetrievalServiceImpl implements RetrievalService {
  private chromaClient: ChromaClient
  private documentRepository: DocumentRepository

  constructor(
    chromaUrl: string = process.env.CHROMA_URL || 'http://localhost:8004'
  ) {
    this.chromaClient = new ChromaClient({ path: chromaUrl })
    this.documentRepository = new PrismaDocumentRepository()
  }

  async searchDocuments(query: string, context: SearchContext): Promise<RetrievedDocument[]> {
    const collectionName = this.getCollectionName(context.workspaceId)
    
    try {
      const embedder = new DefaultEmbeddingFunction()
      const collection = await this.chromaClient.getCollection({ 
        name: collectionName,
        embeddingFunction: embedder
      } as any)

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

          // Skip if chunkId is null
          if (!chunkId) continue

          // Get document information
          const document = await this.documentRepository.getDocument(String(metadata.documentId ?? ''))
          if (!document) continue

          // Calculate relevance score (convert distance to similarity)
          const relevanceScore = 1 - distance

          retrievedDocuments.push({
            id: chunkId,
            documentId: document.id,
            chunkId: chunkId,
            content: content || '',
            metadata: {
              title: document.title,
              source: document.source,
              chunkIndex: Number(metadata.chunkIndex ?? 0),
              totalChunks: Number(metadata.totalChunks ?? 1),
              personId: document.personId || '',
              documentType: (metadata.documentType as DocumentType) ?? DocumentType.OTHER,
              relevanceScore,
              extractedAt: new Date(Number(metadata.extractedAt) || Date.now()),
              embeddingModel: String(metadata.embeddingModel ?? 'nomic-embed-text'),
              chunkSize: Number(metadata.chunkSize ?? 0),
              overlapSize: Number(metadata.overlapSize ?? 0)
            }
          })
        }
      }

      // Rank documents by relevance
      return retrievedDocuments.sort((a, b) => b.metadata.relevanceScore - a.metadata.relevanceScore)
    } catch (error: any) {
      // Handle case where collection doesn't exist yet
      if (error.message?.includes('The requested resource could not be found') || 
          error.name === 'ChromaNotFoundError') {
        console.warn(`ChromaDB collection '${collectionName}' not found. No documents have been ingested yet.`)
        return []
      }
      console.error('Error searching documents:', error)
      throw new Error('Failed to search documents')
    }
  }

  async searchPersonaDocuments(
    personId: string, 
    query: string, 
    context?: SearchContext
  ): Promise<RetrievedDocument[]> {
    if (!context?.workspaceId) {
      throw new Error('workspaceId is required in SearchContext')
    }
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

