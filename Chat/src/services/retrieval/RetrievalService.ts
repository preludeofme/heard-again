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
import { ChromaClient } from 'chromadb'
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
      const collection = await this.chromaClient.getCollection({ name: collectionName } as any)

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
          const document = await this.documentRepository.getDocument(String(metadata.documentId ?? ''))
          if (!document) continue

          // Calculate relevance score (convert distance to similarity)
          const relevanceScore = 1 - (distance || 0)

          // Apply minimum relevance filter
          if (context.minRelevanceScore && relevanceScore < context.minRelevanceScore) {
            continue
          }

          const m = metadata as Record<string, any>
          retrievedDocuments.push({
            id: uuidv4(),
            documentId: String(m.documentId ?? ''),
            chunkId,
            content: content ?? '',
            metadata: {
              title: document.title,
              source: document.source,
              pageNumber: m.pageNumber != null ? Number(m.pageNumber) : undefined,
              chunkIndex: Number(m.chunkIndex ?? 0),
              totalChunks: Number(m.totalChunks ?? 0),
              personId: m.personId != null ? String(m.personId) : undefined,
              documentType: (m.documentType as DocumentType) ?? DocumentType.OTHER,
              relevanceScore,
              extractedAt: new Date(m.extractedAt ?? Date.now()),
              embeddingModel: String(m.embeddingModel ?? 'nomic-embed-text'),
              chunkSize: Number(m.chunkSize ?? 0),
              overlapSize: Number(m.overlapSize ?? 0)
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

