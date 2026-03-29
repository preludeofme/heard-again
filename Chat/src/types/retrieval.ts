// Retrieval and vector search related types

export interface RetrievalService {
  searchDocuments(query: string, context: SearchContext): Promise<RetrievedDocument[]>
  searchPersonaDocuments(personId: string, query: string, context?: SearchContext): Promise<RetrievedDocument[]>
  rankDocuments(documents: RetrievedDocument[], query: string): Promise<RetrievedDocument[]>
  getDocumentById(documentId: string): Promise<Document | null>
  getChunkById(chunkId: string): Promise<DocumentChunk | null>
}

export interface SearchContext {
  workspaceId: string
  personId?: string
  sessionId?: string
  maxResults?: number
  minRelevanceScore?: number
  documentTypes?: DocumentType[]
  dateRange?: {
    start: Date
    end: Date
  }
  filters?: Record<string, any>
}

export interface RetrievedDocument {
  id: string
  documentId: string
  chunkId: string
  content: string
  metadata: {
    title: string
    source: string
    pageNumber?: number
    chunkIndex: number
    totalChunks: number
    personId?: string
    documentType: DocumentType
    relevanceScore: number
    extractedAt: Date
    embeddingModel: string
    chunkSize: number
    overlapSize: number
  }
}

export interface Document {
  id: string
  workspaceId: string
  personId?: string
  title: string
  content: string
  documentType: DocumentType
  source: string
  metadata: {
    originalFileName?: string
    fileSize?: number
    mimeType?: string
    uploadedAt?: Date
    extractedAt?: Date
    processedAt?: Date
    pageCount?: number
    wordCount?: number
    language?: string
  }
  status: DocumentStatus
  embeddingStatus: EmbeddingStatus
  createdAt: Date
  updatedAt: Date
}

export enum DocumentStatus {
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed'
}

export enum EmbeddingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface DocumentChunk {
  id: string
  documentId: string
  chunkIndex: number
  content: string
  metadata: {
    pageNumber?: number
    startPosition: number
    endPosition: number
    wordCount: number
    tokenCount: number
    overlapSize: number
  }
  embedding?: number[]
  embeddingModel?: string
  createdAt: Date
}

export interface VectorSearchConfig {
  embeddingModel: string
  dimension: number
  similarityMetric: 'cosine' | 'euclidean' | 'dotproduct'
  indexType: 'hnsw' | 'ivf' | 'flat'
  efConstruction?: number
  m?: number
  nlist?: number
}

export interface EmbeddingGenerationRequest {
  documentId: string
  chunkSize?: number
  overlapSize?: number
  embeddingModel?: string
  batchSize?: number
}

export interface EmbeddingGenerationResult {
  documentId: string
  totalChunks: number
  processedChunks: number
  failedChunks: number
  processingTime: number
  embeddingModel: string
  errors?: string[]
}

export interface SearchQuery {
  text: string
  filters?: {
    documentTypes?: DocumentType[]
    personIds?: string[]
    dateRange?: {
      start: Date
      end: Date
    }
    minRelevanceScore?: number
  }
  options?: {
    maxResults?: number
    includeMetadata?: boolean
    rerank?: boolean
    expandQuery?: boolean
  }
}

export interface SearchResult {
  documents: RetrievedDocument[]
  totalCount: number
  searchTime: number
  queryExpansion?: string[]
  reranked: boolean
}
