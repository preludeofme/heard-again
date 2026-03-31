import {
  IngestionService,
  IngestionJob,
  IngestionJobType,
  IngestionJobStatus,
  JobPriority,
  JobProgress,
  IngestionConfig,
  IngestionError,
  DocumentProcessor,
  TextExtractionResult,
  DocumentStructure,
  DocumentSection,
  Heading,
  TableData,
  ListData,
  ExtractedImage,
  DocumentMetadata,
  FileValidationResult,
  ValidationError,
  ValidationWarning,
  SupportedFormat
} from '@/types'
import { queueManager, QUEUE_NAMES, JobUtils } from '@/utils/queues'
import { v4 as uuidv4 } from 'uuid'

export class IngestionServiceImpl implements IngestionService {
  constructor(
    private documentProcessor: DocumentProcessor,
    private embeddingGenerator: EmbeddingGenerator,
    private documentRepository: DocumentRepository
  ) {}

  async submitDocument(
    file: File,
    workspaceId: string,
    userId: string,
    config?: IngestionConfig
  ): Promise<IngestionJob> {
    // Validate file
    const validation = this.validateFile(file)
    if (!validation.isValid) {
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`)
    }

    // Create ingestion job
    const jobId = JobUtils.createJobId()
    const job: IngestionJob = {
      id: jobId,
      documentId: uuidv4(),
      workspaceId,
      userId,
      type: IngestionJobType.DOCUMENT_PROCESSING,
      status: IngestionJobStatus.QUEUED,
      priority: JobPriority.NORMAL,
      progress: {
        currentStep: 'queued',
        totalSteps: 5,
        completedSteps: 0,
        percentage: 0
      },
      config: config || this.getDefaultConfig(),
      metadata: {
        originalFileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        uploadedAt: new Date().toISOString()
      },
      createdAt: new Date()
    }

    // Store file temporarily
    const filePath = await this.storeFile(file, job.documentId)

    // Queue the job
    const queue = queueManager.createQueue(QUEUE_NAMES.DOCUMENT_INGESTION)
    await queue.add(
      'process-document',
      {
        ...job,
        filePath,
        traceId: uuidv4()
      },
      {
        priority: this.getPriorityValue(job.priority),
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    )

    return job
  }

  async getJobStatus(jobId: string): Promise<IngestionJob | null> {
    // TODO: Implement database query to get job status
    throw new Error('Not implemented - database integration needed')
  }

  async listJobs(
    workspaceId: string,
    filters?: {
      status?: IngestionJobStatus
      type?: IngestionJobType
      userId?: string
    }
  ): Promise<IngestionJob[]> {
    // TODO: Implement database query with filters
    throw new Error('Not implemented - database integration needed')
  }

  async cancelJob(jobId: string): Promise<void> {
    // TODO: Implement job cancellation
    throw new Error('Not implemented - queue cancellation needed')
  }

  async retryJob(jobId: string): Promise<IngestionJob> {
    // TODO: Implement job retry logic
    throw new Error('Not implemented - job retry needed')
  }

  async deleteJob(jobId: string): Promise<void> {
    // TODO: Implement job deletion and cleanup
    throw new Error('Not implemented - job cleanup needed')
  }

  async getJobProgress(jobId: string): Promise<JobProgress> {
    // TODO: Implement progress tracking
    throw new Error('Not implemented - progress tracking needed')
  }

  private validateFile(file: File): FileValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Check file size
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      errors.push({
        code: 'FILE_TOO_LARGE',
        message: `File size ${file.size} exceeds maximum allowed size ${maxSize}`,
        severity: 'error'
      })
    }

    // Check file type
    const supportedTypes: SupportedFormat[] = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/markdown',
      'image/jpeg',
      'image/png',
      'image/tiff'
    ]

    if (!supportedTypes.includes(file.type as SupportedFormat)) {
      errors.push({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: `File type ${file.type} is not supported`,
        severity: 'error'
      })
    }

    // Check filename
    if (!file.name || file.name.trim().length === 0) {
      errors.push({
        code: 'INVALID_FILENAME',
        message: 'Filename is required',
        severity: 'error'
      })
    }

    // Check for potentially problematic filenames
    const problematicChars = /[<>:"/\\|?*]/
    if (problematicChars.test(file.name)) {
      warnings.push({
        code: 'PROBLEMATIC_FILENAME',
        message: 'Filename contains special characters that may cause issues',
        severity: 'warning'
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fileType: file.type as SupportedFormat,
      fileSize: file.size,
      fileName: file.name
    }
  }

  private getDefaultConfig(): IngestionConfig {
    return {
      chunkSize: 1000,
      overlapSize: 200,
      embeddingModel: 'nomic-embed-text',
      enableOCR: true,
      extractImages: true,
      extractTables: true,
      extractHeadings: true,
      minChunkSize: 100,
      maxChunkSize: 2000,
      language: 'en'
    }
  }

  private getPriorityValue(priority: JobPriority): number {
    switch (priority) {
      case JobPriority.LOW: return 1
      case JobPriority.NORMAL: return 5
      case JobPriority.HIGH: return 10
      case JobPriority.URGENT: return 15
      default: return 5
    }
  }

  private async storeFile(file: File, documentId: string): Promise<string> {
    const fs = require('fs').promises
    const path = require('path')
    
    const uploadDir = process.env.UPLOAD_DIR || './uploads'
    const fileName = `${documentId}_${file.name}`
    const filePath = path.join(uploadDir, fileName)

    // Ensure upload directory exists
    await fs.mkdir(uploadDir, { recursive: true })

    // Store file
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    return filePath
  }
}

// Document processor implementation
export class DocumentProcessorImpl implements DocumentProcessor {
  async extractText(filePath: string, mimeType: string): Promise<TextExtractionResult> {
    switch (mimeType) {
      case 'application/pdf':
        return await this.extractPDFText(filePath)
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await this.extractDocxText(filePath)
      case 'application/msword':
        return await this.extractDocText(filePath)
      case 'text/plain':
        return await this.extractPlainText(filePath)
      case 'text/markdown':
        return await this.extractMarkdownText(filePath)
      case 'image/jpeg':
      case 'image/png':
      case 'image/tiff':
        return await this.extractImageText(filePath)
      default:
        throw new Error(`Unsupported file type: ${mimeType}`)
    }
  }

  async parseDocumentStructure(
    text: string,
    mimeType: string
  ): Promise<DocumentStructure> {
    const sections: DocumentSection[] = []
    const headings: Heading[] = []
    const tables: TableData[] = []
    const lists: ListData[] = []
    const images: ExtractedImage[] = []

    // Extract headings (simple regex-based approach)
    const headingRegex = /^(#{1,6})\s+(.+)$/gm
    let match
    while ((match = headingRegex.exec(text)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        position: match.index
      })
    }

    // Extract tables (basic detection)
    const tableRegex = /\|(.+)\|/g
    while ((match = tableRegex.exec(text)) !== null) {
      tables.push({
        headers: [],
        rows: [],
        position: match.index
      })
    }

    // Extract lists (basic detection)
    const listRegex = /^[-*+]\s+(.+)$/gm
    while ((match = listRegex.exec(text)) !== null) {
      lists.push({
        type: 'unordered',
        items: [match[1].trim()],
        position: match.index
      })
    }

    // Create sections based on headings
    if (headings.length > 0) {
      for (let i = 0; i < headings.length; i++) {
        const heading = headings[i]
        const nextHeading = headings[i + 1]
        const start = heading.position
        const end = nextHeading ? nextHeading.position : text.length

        sections.push({
          type: 'heading',
          content: text.substring(start, end).trim(),
          heading: heading.text,
          level: heading.level,
          position: start
        })
      }
    } else {
      // No headings, create one section
      sections.push({
        type: 'content',
        content: text,
        position: 0
      })
    }

    return {
      sections,
      headings,
      tables,
      lists,
      images,
      metadata: {
        totalCharacters: text.length,
        totalWords: text.split(/\s+/).length,
        totalSections: sections.length,
        totalHeadings: headings.length,
        totalTables: tables.length,
        totalLists: lists.length,
        totalImages: images.length
      }
    }
  }

  async extractMetadata(
    filePath: string,
    mimeType: string
  ): Promise<DocumentMetadata> {
    const fs = require('fs').promises
    const path = require('path')
    
    const stats = await fs.stat(filePath)
    const fileName = path.basename(filePath)

    return {
      fileName,
      filePath,
      fileSize: stats.size,
      mimeType,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      encoding: 'utf-8',
      language: 'en',
      pageCount: mimeType === 'application/pdf' ? await this.getPDFPageCount(filePath) : undefined,
      wordCount: 0, // Will be calculated after text extraction
      characterCount: 0 // Will be calculated after text extraction
    }
  }

  private async extractPDFText(filePath: string): Promise<TextExtractionResult> {
    const fs = require('fs').promises
    const { PDFParser } = require('@/utils/parsers')
    
    try {
      const buffer = await fs.readFile(filePath)
      return await PDFParser.parsePDF(buffer)
    } catch (error) {
      throw new Error(`PDF text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async extractDocxText(filePath: string): Promise<TextExtractionResult> {
    const fs = require('fs').promises
    const { DOCXParser } = require('@/utils/parsers')
    
    try {
      const buffer = await fs.readFile(filePath)
      return await DOCXParser.parseDOCX(buffer)
    } catch (error) {
      throw new Error(`DOCX text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async extractDocText(filePath: string): Promise<TextExtractionResult> {
    // Legacy .doc files are not easily supported, try to extract as text
    const fs = require('fs').promises
    const { TextParser } = require('@/utils/parsers')
    
    try {
      const buffer = await fs.readFile(filePath)
      return await TextParser.parseText(buffer)
    } catch (error) {
      throw new Error(`DOC text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async extractPlainText(filePath: string): Promise<TextExtractionResult> {
    const fs = require('fs').promises
    const { TextParser } = require('@/utils/parsers')
    
    try {
      const buffer = await fs.readFile(filePath)
      return await TextParser.parseText(buffer)
    } catch (error) {
      throw new Error(`Plain text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async extractMarkdownText(filePath: string): Promise<TextExtractionResult> {
    const fs = require('fs').promises
    const { MarkdownParser } = require('@/utils/parsers')
    
    try {
      const buffer = await fs.readFile(filePath)
      return await MarkdownParser.parseMarkdown(buffer)
    } catch (error) {
      throw new Error(`Markdown text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async extractImageText(filePath: string): Promise<TextExtractionResult> {
    const fs = require('fs').promises
    const { ImageParser } = require('@/utils/parsers')
    
    try {
      const buffer = await fs.readFile(filePath)
      // Determine MIME type from file extension
      const path = require('path')
      const ext = path.extname(filePath).toLowerCase()
      const mimeType = this.getMimeTypeFromExtension(ext)
      
      return await ImageParser.parseImageWithOCR(buffer, mimeType)
    } catch (error) {
      throw new Error(`Image OCR extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private getMimeTypeFromExtension(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',
      '.bmp': 'image/bmp'
    }
    return mimeTypes[ext] || 'image/jpeg'
  }

  private async getPDFPageCount(filePath: string): Promise<number> {
    // TODO: Implement PDF page count extraction
    return 1
  }
}

// Interface for embedding generator
export interface EmbeddingGenerator {
  generateEmbeddings(texts: string[]): Promise<number[][]>
}

// Interface for document repository
export interface DocumentRepository {
  createDocument(document: any): Promise<any>
  updateDocument(document: any): Promise<any>
  deleteDocument(documentId: string): Promise<void>
  getDocument(documentId: string): Promise<any>
}
