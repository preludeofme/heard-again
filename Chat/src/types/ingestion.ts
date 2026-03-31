import type { DocumentChunk } from './retrieval'

// Document ingestion and processing types

export interface IngestionService {
  ingestDocument(documentId: string): Promise<IngestionJob>
  processChunk(chunk: DocumentChunk): Promise<Embedding>
  updateDocumentEmbeddings(documentId: string): Promise<void>
  getJobStatus(jobId: string): Promise<IngestionJob>
  retryFailedJob(jobId: string): Promise<IngestionJob>
}

export interface IngestionJob {
  id: string
  documentId: string
  workspaceId: string
  userId: string
  type: IngestionJobType
  status: IngestionJobStatus
  priority: JobPriority
  progress: JobProgress
  config: IngestionConfig
  error?: IngestionError
  metadata: {
    originalFileName: string
    fileSize: number
    mimeType: string
    estimatedProcessingTime?: number
  }
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  updatedAt: Date
}

export enum IngestionJobType {
  DOCUMENT_PROCESSING = 'document_processing',
  TEXT_EXTRACTION = 'text_extraction',
  CHUNKING = 'chunking',
  EMBEDDING_GENERATION = 'embedding_generation',
  INDEXING = 'indexing'
}

export enum IngestionJobStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying'
}

export enum JobPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface JobProgress {
  currentStep: string
  totalSteps: number
  completedSteps: number
  percentage: number
  estimatedTimeRemaining?: number
  currentOperation?: string
}

export interface IngestionConfig {
  chunkSize: number
  overlapSize: number
  embeddingModel: string
  batchSize: number
  maxRetries: number
  retryDelay: number
  enableOCR: boolean
  preserveFormatting: boolean
  extractMetadata: boolean
}

export interface IngestionError {
  code: string
  message: string
  details?: Record<string, any>
  stack?: string
  retryable: boolean
}

export interface DocumentProcessor {
  extractText(file: Buffer, mimeType: string): Promise<TextExtractionResult>
  parseMetadata(file: Buffer, mimeType: string): Promise<DocumentMetadata>
  validateFile(file: Buffer, mimeType: string): Promise<FileValidationResult>
  getSupportedFormats(): SupportedFormat[]
}

export interface TextExtractionResult {
  text: string
  metadata: {
    pageCount?: number
    wordCount: number
    language: string
    confidence: number
    extractionMethod: string
  }
  structure?: DocumentStructure
  images?: ExtractedImage[]
}

export interface DocumentStructure {
  sections: DocumentSection[]
  headings: Heading[]
  tables?: TableData[]
  lists?: ListData[]
}

export interface DocumentSection {
  title?: string
  content: string
  level: number
  startPosition: number
  endPosition: number
}

export interface Heading {
  text: string
  level: number
  position: number
}

export interface TableData {
  rows: string[][]
  headers: string[]
  position: number
}

export interface ListData {
  items: string[]
  type: 'ordered' | 'unordered'
  position: number
}

export interface ExtractedImage {
  data: Buffer
  mimeType: string
  position: number
  caption?: string
  altText?: string
}

export interface DocumentMetadata {
  title?: string
  author?: string
  createdAt?: Date
  modifiedAt?: Date
  subject?: string
  keywords?: string[]
  language?: string
  pageCount?: number
  wordCount?: number
  characterCount?: number
}

export interface FileValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  detectedType: string
  detectedEncoding?: string
}

export interface ValidationError {
  code: string
  message: string
  severity: 'error' | 'warning'
  position?: number
}

export interface ValidationWarning {
  code: string
  message: string
  suggestion?: string
}

export interface SupportedFormat {
  mimeType: string
  extensions: string[]
  parser: string
  maxSize: number
  features: string[]
}

export interface EmbeddingGenerator {
  generateEmbedding(text: string): Promise<Embedding>
  generateBatchEmbeddings(texts: string[]): Promise<Embedding[]>
  getModelInfo(): Promise<EmbeddingModelInfo>
}

export interface Embedding {
  vector: number[]
  dimension: number
  model: string
  processingTime: number
  tokenCount: number
}

export interface EmbeddingModelInfo {
  name: string
  dimension: number
  maxTokens: number
  supportedLanguages: string[]
  description: string
}
