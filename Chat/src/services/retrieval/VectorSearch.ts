import {
  RetrievedDocument,
  SearchQuery,
  SearchResult,
  SearchContext,
  Document,
  DocumentType
} from '@/types'
import { EmbeddingGeneratorImpl } from '@/services/ingestion/EmbeddingGenerator'
import axios from 'axios'

export class VectorSearchImpl {
  private embeddingGenerator: EmbeddingGeneratorImpl
  private chromaUrl: string

  constructor(
    chromaUrl: string = process.env.CHROMA_URL || 'http://localhost:8004'
  ) {
    this.chromaUrl = chromaUrl
    this.embeddingGenerator = new EmbeddingGeneratorImpl()
  }

  async search(
    query: string,
    context: SearchContext,
    options?: {
      maxResults?: number
      minRelevanceScore?: number
      useHybridSearch?: boolean
      rerank?: boolean
    }
  ): Promise<RetrievedDocument[]> {
    const maxResults = options?.maxResults || context.maxResults || 10
    const minRelevanceScore = options?.minRelevanceScore || context.minRelevanceScore || 0.5

    try {
      // Generate query embedding
      const queryEmbeddingResult = await this.embeddingGenerator.generateEmbedding(query)
      const queryEmbedding = queryEmbeddingResult.vector

      // Build ChromaDB query
      const collectionName = this.getCollectionName(context.workspaceId)
      const whereFilters = this.buildWhereFilters(context)

      // Search ChromaDB
      const searchResults = await this.searchChromaDB(
        collectionName,
        queryEmbedding,
        maxResults,
        whereFilters
      )

      // Convert to RetrievedDocument format
      const retrievedDocuments: RetrievedDocument[] = []

      for (const result of searchResults) {
        const relevanceScore = 1 - (result.distance || 0) // Convert distance to similarity

        // Apply minimum relevance filter
        if (relevanceScore < minRelevanceScore) {
          continue
        }

        retrievedDocuments.push({
          id: `doc_${result.id}`,
          documentId: result.metadata.documentId,
          chunkId: result.id,
          content: result.content,
          metadata: {
            title: result.metadata.title || 'Untitled Document',
            source: result.metadata.source || 'Unknown',
            pageNumber: result.metadata.pageNumber,
            chunkIndex: result.metadata.chunkIndex,
            totalChunks: result.metadata.totalChunks,
            personId: result.metadata.personId,
            documentType: result.metadata.documentType,
            relevanceScore,
            extractedAt: new Date(result.metadata.extractedAt || Date.now()),
            embeddingModel: result.metadata.embeddingModel || 'nomic-embed-text',
            chunkSize: result.metadata.chunkSize || 0,
            overlapSize: result.metadata.overlapSize || 0
          }
        })
      }

      // Rerank results if requested
      if (options?.rerank && retrievedDocuments.length > 1) {
        return await this.rerankResults(query, retrievedDocuments)
      }

      return retrievedDocuments.sort((a, b) => b.metadata.relevanceScore - a.metadata.relevanceScore)

    } catch (error) {
      console.error('Vector search failed:', error)
      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async hybridSearch(
    query: string,
    context: SearchContext,
    options?: {
      maxResults?: number
      keywordWeight?: number
      semanticWeight?: number
    }
  ): Promise<RetrievedDocument[]> {
    const keywordWeight = options?.keywordWeight || 0.3
    const semanticWeight = options?.semanticWeight || 0.7

    try {
      // Perform semantic search
      const semanticResults = await this.search(query, context, options)

      // Perform keyword search (simplified implementation)
      const keywordResults = await this.keywordSearch(query, context, options)

      // Combine and re-weight results
      const combinedResults = this.combineSearchResults(
        semanticResults,
        keywordResults,
        semanticWeight,
        keywordWeight
      )

      return combinedResults

    } catch (error) {
      console.error('Hybrid search failed:', error)
      throw new Error(`Hybrid search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async searchSimilar(
    documentId: string,
    context: SearchContext,
    options?: {
      maxResults?: number
      minRelevanceScore?: number
    }
  ): Promise<RetrievedDocument[]> {
    try {
      // Get the document to find similar items for
      const document = await this.getDocument(documentId)
      if (!document) {
        throw new Error(`Document ${documentId} not found`)
      }

      // Use the document's content as the query
      const queryText = document.content.substring(0, 1000) // Use first 1000 chars

      return await this.search(queryText, context, {
        ...options,
        maxResults: (options?.maxResults || 10) + 1 // +1 to exclude the original document
      })

    } catch (error) {
      console.error('Similar document search failed:', error)
      throw new Error(`Similar document search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async searchWithFilters(
    query: string,
    context: SearchContext,
    filters: {
      documentTypes?: string[]
      dateRange?: { start: Date; end: Date }
      personIds?: string[]
      minWordCount?: number
      maxWordCount?: number
    },
    options?: {
      maxResults?: number
      minRelevanceScore?: number
    }
  ): Promise<RetrievedDocument[]> {
    // Combine context filters with additional filters
    const enhancedContext: SearchContext = {
      ...context,
      documentTypes: filters.documentTypes as unknown as DocumentType[] | undefined,
      dateRange: filters.dateRange,
      filters: {
        ...context.filters,
        minWordCount: filters.minWordCount,
        maxWordCount: filters.maxWordCount
      }
    }

    return await this.search(query, enhancedContext, options)
  }

  private async searchChromaDB(
    collectionName: string,
    queryEmbedding: number[],
    maxResults: number,
    whereFilters: any
  ): Promise<any[]> {
    try {
      const response = await axios.post(
        `${this.chromaUrl}/api/v1/collections/${collectionName}/query`,
        {
          query_embeddings: [queryEmbedding],
          n_results: maxResults,
          where: Object.keys(whereFilters).length > 0 ? whereFilters : undefined,
          include: ['metadatas', 'documents', 'distances']
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.data.ids || !response.data.ids[0]) {
        return []
      }

      const results = []
      for (let i = 0; i < response.data.ids[0].length; i++) {
        results.push({
          id: response.data.ids[0][i],
          content: response.data.documents[0][i],
          metadata: response.data.metadatas[0][i] || {},
          distance: response.data.distances[0][i]
        })
      }

      return results

    } catch (error) {
      console.error('ChromaDB search failed:', error)
      throw new Error('ChromaDB search failed')
    }
  }

  private async keywordSearch(
    query: string,
    context: SearchContext,
    options?: { maxResults?: number }
  ): Promise<RetrievedDocument[]> {
    // Simplified keyword search implementation
    // In a real implementation, this would use a full-text search engine
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    
    // Mock results - in reality, this would query a search index
    return []
  }

  private combineSearchResults(
    semanticResults: RetrievedDocument[],
    keywordResults: RetrievedDocument[],
    semanticWeight: number,
    keywordWeight: number
  ): RetrievedDocument[] {
    const combinedScores = new Map<string, RetrievedDocument>()

    // Add semantic results
    semanticResults.forEach(doc => {
      const key = doc.documentId
      combinedScores.set(key, {
        ...doc,
        metadata: {
          ...doc.metadata,
          relevanceScore: doc.metadata.relevanceScore * semanticWeight
        }
      })
    })

    // Add/combine keyword results
    keywordResults.forEach(doc => {
      const key = doc.documentId
      const existing = combinedScores.get(key)
      
      if (existing) {
        existing.metadata.relevanceScore += doc.metadata.relevanceScore * keywordWeight
      } else {
        combinedScores.set(key, {
          ...doc,
          metadata: {
            ...doc.metadata,
            relevanceScore: doc.metadata.relevanceScore * keywordWeight
          }
        })
      }
    })

    return Array.from(combinedScores.values())
      .sort((a, b) => b.metadata.relevanceScore - a.metadata.relevanceScore)
  }

  private async rerankResults(
    query: string,
    results: RetrievedDocument[]
  ): Promise<RetrievedDocument[]> {
    // Simple reranking based on query term density
    const queryTerms = query.toLowerCase().split(/\s+/)
    
    return results.map(doc => {
      const content = doc.content.toLowerCase()
      const termMatches = queryTerms.filter(term => content.includes(term)).length
      const termDensity = termMatches / queryTerms.length
      
      // Adjust relevance score based on term density
      const adjustedScore = doc.metadata.relevanceScore * (0.7 + 0.3 * termDensity)
      
      return {
        ...doc,
        metadata: {
          ...doc.metadata,
          relevanceScore: adjustedScore
        }
      }
    }).sort((a, b) => b.metadata.relevanceScore - a.metadata.relevanceScore)
  }

  private buildWhereFilters(context: SearchContext): any {
    const filters: any = {}

    if (context.personId) {
      filters.personId = context.personId
    }

    if (context.documentTypes && context.documentTypes.length > 0) {
      filters.documentType = { $in: context.documentTypes }
    }

    if (context.dateRange) {
      filters.createdAt = {
        $gte: context.dateRange.start.getTime(),
        $lte: context.dateRange.end.getTime()
      }
    }

    if (context.personId) {
      filters.personId = context.personId
    }

    // Add custom filters
    if (context.filters) {
      Object.assign(filters, context.filters)
    }

    return filters
  }

  private getCollectionName(workspaceId: string): string {
    return `workspace_${workspaceId}_documents`
  }

  private async getDocument(documentId: string): Promise<Document | null> {
    // TODO: Implement database query
    // This would typically query the database for the document
    return null
  }

  // Utility methods
  static async calculateRelevanceScore(
    queryEmbedding: number[],
    documentEmbedding: number[]
  ): Promise<number> {
    // Cosine similarity
    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < queryEmbedding.length; i++) {
      dotProduct += queryEmbedding[i] * documentEmbedding[i]
      normA += queryEmbedding[i] * queryEmbedding[i]
      normB += documentEmbedding[i] * documentEmbedding[i]
    }

    normA = Math.sqrt(normA)
    normB = Math.sqrt(normB)

    if (normA === 0 || normB === 0) {
      return 0
    }

    return dotProduct / (normA * normB)
  }

  static async filterByRelevance(
    results: RetrievedDocument[],
    minScore: number
  ): Promise<RetrievedDocument[]> {
    return results.filter(doc => doc.metadata.relevanceScore >= minScore)
  }

  static async deduplicateResults(
    results: RetrievedDocument[]
  ): Promise<RetrievedDocument[]> {
    const seen = new Set<string>()
    const deduplicated: RetrievedDocument[] = []

    for (const doc of results) {
      const key = `${doc.documentId}_${doc.chunkId}`
      if (!seen.has(key)) {
        seen.add(key)
        deduplicated.push(doc)
      }
    }

    return deduplicated
  }
}
