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
    console.log(`[RAG] Searching documents for query: "${query}" in collection: ${collectionName}`)
    
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
        console.log(`[RAG] Filtering by personId: ${context.personId}`)
      }
      if (context.documentTypes && context.documentTypes.length > 0) {
        whereFilters.documentType = { $in: context.documentTypes }
        console.log(`[RAG] Filtering by documentTypes: ${context.documentTypes.join(', ')}`)
      }
      if (context.dateRange) {
        whereFilters.createdAt = {
          $gte: context.dateRange.start.getTime(),
          $lte: context.dateRange.end.getTime()
        }
        console.log(`[RAG] Filtering by date range: ${context.dateRange.start} to ${context.dateRange.end}`)
      }

      console.log(`[RAG] Querying with filters:`, whereFilters)
      
      const results = await collection.query({
        queryTexts: [query],
        nResults: context.maxResults || 5,
        where: Object.keys(whereFilters).length > 0 ? whereFilters : undefined
      })

      console.log(`[RAG] Retrieved ${results.ids[0]?.length || 0} documents`)
      console.log(`[RAG] Document IDs:`, results.ids[0])
      console.log(`[RAG] Document contents length:`, results.documents[0]?.map(d => d?.length || 0))

      const retrievedDocuments: RetrievedDocument[] = []
      
      if (results.ids[0] && results.documents[0] && results.metadatas[0] && results.distances && results.distances[0]) {
        console.log(`[RAG] Processing ${results.ids[0].length} documents...`)
        for (let i = 0; i < results.ids[0].length; i++) {
          const chunkId = results.ids[0][i]
          const content = results.documents[0][i]
          const metadata = results.metadatas[0][i]
          const distance = results.distances[0][i]

          // Skip if chunkId is null
          if (!chunkId) continue

          // Get document information - if documentId is in metadata, try to fetch from DB
          // Otherwise, create a document object from the ChromaDB data
          let document: Document | null = null
          const metadataDocumentId = metadata?.documentId ?? metadata?.id
          
          if (metadataDocumentId) {
            document = await this.documentRepository.getDocument(String(metadataDocumentId))
          }
          
          // If no document found in DB, create one from ChromaDB data
          if (!document && metadata) {
            document = {
              id: metadataDocumentId || chunkId,
              title: metadata.title || 'Untitled Document',
              content: content || '',
              source: metadata.source || 'chromadb',
              personId: metadata.personId || context.personId || '',
              documentType: (metadata.documentType as DocumentType) || DocumentType.OTHER,
              status: 'processed',
              embeddingStatus: 'completed',
              metadata: {},
              createdAt: new Date(Number(metadata.createdAt) || Date.now()),
              updatedAt: new Date(Number(metadata.createdAt) || Date.now())
            }
          }
          
          if (!document) continue

          // Calculate relevance score (convert distance to similarity)
          const relevanceScore = 1 - (distance ?? 0)

          retrievedDocuments.push({
            id: chunkId,
            documentId: document.id,
            chunkId: chunkId,
            content: content || '',
            metadata: {
              title: document.title,
              source: document.source,
              chunkIndex: Number(metadata?.chunkIndex ?? 0),
              totalChunks: Number(metadata?.totalChunks ?? 1),
              personId: document.personId || '',
              documentType: (metadata?.documentType as DocumentType) ?? DocumentType.OTHER,
              relevanceScore,
              extractedAt: new Date(Number(metadata?.extractedAt) || metadata?.createdAt || Date.now()),
              embeddingModel: String(metadata?.embeddingModel ?? 'nomic-embed-text'),
              chunkSize: Number(metadata?.chunkSize ?? (content?.length ?? 0)),
              overlapSize: Number(metadata?.overlapSize ?? 0)
            }
          })
        }
      }

      console.log(`[RAG] Processed ${retrievedDocuments.length} retrieved documents`)
      // Rank documents by relevance
      return retrievedDocuments.sort((a, b) => b.metadata.relevanceScore - a.metadata.relevanceScore)
    } catch (error) {
      console.error(`[RAG] Error searching documents:`, error)
      return []
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

  async getChunkById(chunkId: string): Promise<DocumentChunk | null> {
    return await this.documentRepository.getChunk(chunkId)
  }

  async searchPersonaDocuments(
    personId: string, 
    query: string, 
    context?: SearchContext
  ): Promise<RetrievedDocument[]> {
    if (!context?.workspaceId) {
      throw new Error('workspaceId is required in SearchContext')
    }
    
    return await this.searchDocuments(query, {
      ...context,
      personId
    })
  }

  async rankDocuments(documents: RetrievedDocument[], query: string): Promise<RetrievedDocument[]> {
    // For now, just return documents sorted by relevance score
    // In a more sophisticated implementation, we could re-rank based on query similarity
    return documents.sort((a, b) => b.metadata.relevanceScore - a.metadata.relevanceScore)
  }

  private getCollectionName(workspaceId: string): string {
    return `workspace_${workspaceId}_documents`
  }
}

