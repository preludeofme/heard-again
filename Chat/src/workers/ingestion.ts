import { Worker } from 'bullmq'
import { queueManager, QUEUE_NAMES, JobUtils } from '@/utils/queues'
import { SimpleIngestionService, SimpleDocumentProcessor } from '@/services/ingestion/SimpleIngestionService'
import { EmbeddingGeneratorImpl } from '@/services/ingestion/EmbeddingGenerator'
import { PrismaDocumentRepository } from '@/repositories/DocumentRepository'
import { DocumentStatus, EmbeddingStatus } from '@/types/retrieval'
import { logger } from '@/lib/logger'
import { ChromaClient, DefaultEmbeddingFunction } from 'chromadb'

export class IngestionWorker {
  private worker: Worker | null = null
  private ingestionService: SimpleIngestionService
  private documentProcessor: SimpleDocumentProcessor

  constructor() {
    // Create services
    const documentRepository = new PrismaDocumentRepository()
    const embeddingGenerator = new EmbeddingGeneratorImpl()
    this.ingestionService = new SimpleIngestionService(
      documentRepository,
      embeddingGenerator
    )
    this.documentProcessor = new SimpleDocumentProcessor()
  }

  async start(): Promise<void> {
    logger.info('Starting ingestion worker')

    this.worker = queueManager.createWorker(
      QUEUE_NAMES.DOCUMENT_INGESTION,
      this.processJob.bind(this),
      {
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || '3'),
        limiter: {
          max: 100,
          duration: 60000, // 1 minute
        }
      }
    )

    // Set up event listeners
    this.worker.on('completed', (job, result) => {
      logger.info(
        { jobId: job.id, documentId: result?.documentId, chunksProcessed: result?.chunksProcessed, embeddingsGenerated: result?.embeddingsGenerated, processingTimeMs: result?.processingTime },
        'RAG ingestion job completed ✓'
      )
    })

    this.worker.on('failed', (job, err) => {
      logger.error(
        { jobId: job?.id, documentId: job?.data?.documentId, traceId: job?.data?.traceId, attemptsMade: job?.attemptsMade, err: err?.message },
        'RAG ingestion job failed'
      )
    })

    this.worker.on('error', (err) => {
      logger.error({ err: err?.message }, 'Ingestion worker error')
    })

    logger.info('Ingestion worker ready')
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close()
      this.worker = null
      logger.info('Ingestion worker stopped')
    }
  }

  private async processJob(job: any): Promise<any> {
    const { documentId, filePath, workspaceId, mimeType, title, personId, config, traceId } = job.data
    const startMs = Date.now()

    logger.info({ jobId: job.id, documentId, workspaceId, mimeType, title, traceId }, 'RAG ingestion job started')

    try {
      // Step 1: Extract text
      await JobUtils.updateJobProgress(job, {
        currentStep: 'extracting_text',
        totalSteps: 5,
        completedSteps: 0,
        currentOperation: 'Reading file and extracting text content'
      })

      const fs = require('fs').promises
      const buffer = await fs.readFile(filePath)

      // Extract text using document processor (mimeType comes from job.data)
      const textResult = await this.documentProcessor.extractText(buffer, mimeType)
      
      if (!textResult.text || textResult.text.trim().length === 0) {
        throw new Error('No text content extracted from document')
      }
      const wordCount = textResult.text.split(/\s+/).filter(Boolean).length
      logger.info({ documentId, traceId, wordCount, mimeType }, 'Text extraction complete')

      await JobUtils.updateJobProgress(job, {
        currentStep: 'parsing_structure',
        totalSteps: 5,
        completedSteps: 1,
        currentOperation: 'Analyzing document structure and sections'
      })

      // Step 2: Parse document structure (simplified for now)
      const structure = { sections: [], headings: [], tables: [], lists: [] }

      await JobUtils.updateJobProgress(job, {
        currentStep: 'chunking',
        totalSteps: 5,
        completedSteps: 2,
        currentOperation: 'Splitting text into searchable chunks'
      })

      // Step 3: Chunk the text
      const chunks = this.chunkText(textResult.text, config)
      logger.info({ documentId, traceId, chunkCount: chunks.length }, 'Text chunked')
      
      await JobUtils.updateJobProgress(job, {
        currentStep: 'generating_embeddings',
        totalSteps: 5,
        completedSteps: 3,
        currentOperation: 'Creating vector embeddings for chunks'
      })

      // Step 4: Generate Ollama embeddings (for Postgres storage — non-critical)
      // ChromaDB uses DefaultEmbeddingFunction independently, so Ollama failure
      // must NOT block the critical RAG indexing path.
      let embeddings: number[][] = []
      try {
        logger.info({ documentId, traceId, chunkCount: chunks.length }, 'Generating Ollama embeddings for Postgres')
        const embeddingGenerator = new EmbeddingGeneratorImpl()
        const chunkTexts = chunks.map(chunk => chunk.content)
        embeddings = await embeddingGenerator.generateEmbeddings(chunkTexts)
        logger.info({ documentId, traceId, embeddingCount: embeddings.length }, 'Ollama embeddings generated')
      } catch (embErr) {
        logger.warn(
          { documentId, traceId, err: embErr instanceof Error ? embErr.message : String(embErr) },
          'Ollama embedding generation failed — continuing without Postgres embeddings (ChromaDB will generate its own)'
        )
        embeddings = chunks.map(() => [])
      }

      await JobUtils.updateJobProgress(job, {
        currentStep: 'indexing',
        totalSteps: 5,
        completedSteps: 4,
        currentOperation: 'Storing chunks and embeddings in database'
      })

      // Step 5: Store in database
      await this.storeDocument({
        id: documentId,
        workspaceId,
        title,
        content: textResult.text,
        mimeType,
        personId: personId || null,
        chunks: chunks.map((chunk, index) => ({
          ...chunk,
          embedding: embeddings[index] || [],
          embeddingModel: 'nomic-embed-text'
        })),
        structure,
        metadata: {
          originalFileName: title,
          fileSize: buffer.length,
          extractedAt: new Date(),
          processingTime: Date.now() - job.timestamp,
          chunkCount: chunks.length,
          wordCount: textResult.text.split(/\s+/).length
        }
      })

      // Clean up temporary file
      try {
        await fs.unlink(filePath)
      } catch (error) {
        logger.warn({ filePath, err: error instanceof Error ? error.message : String(error) }, 'Failed to clean up temp file after ingestion')
      }

      await JobUtils.updateJobProgress(job, {
        currentStep: 'completed',
        totalSteps: 5,
        completedSteps: 5,
        currentOperation: 'Document processing completed successfully'
      })

      const processingTime = Date.now() - startMs
      logger.info(
        { jobId: job.id, documentId, traceId, chunksProcessed: chunks.length, embeddingsGenerated: embeddings.length, processingTimeMs: processingTime },
        'Document processing complete — chunks stored in Postgres + ChromaDB ✓'
      )

      return {
        success: true,
        documentId,
        chunksProcessed: chunks.length,
        embeddingsGenerated: embeddings.length,
        processingTime,
      }

    } catch (error) {
      await JobUtils.addJobError(job, error instanceof Error ? error.message : 'Unknown error')
      
      logger.error(
        { jobId: job.id, documentId, traceId, err: error instanceof Error ? error.message : String(error) },
        'Document processing failed'
      )
      
      // Only clean up temp file on final attempt — preserve for BullMQ retries
      const maxAttempts = job.opts?.attempts || 3
      if (job.attemptsMade >= maxAttempts) {
        try {
          const fs = require('fs').promises
          await fs.unlink(filePath)
          logger.info({ filePath }, 'Temp file cleaned up after final attempt')
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }

      throw error
    }
  }

  private getMimeTypeFromPath(filePath: string): string {
    const path = require('path')
    const ext = path.extname(filePath).toLowerCase()
    
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.tiff': 'image/tiff'
    }

    return mimeTypes[ext] || 'application/octet-stream'
  }

  private chunkText(text: string, config: any): Array<{ id: string; content: string; index: number }> {
    const chunkSize = config?.chunkSize || 1000
    const overlapSize = config?.overlapSize || 200
    const chunks: Array<{ id: string; content: string; index: number }> = []

    let start = 0
    let chunkIndex = 0

    while (start < text.length) {
      let end = start + chunkSize
      
      // Try to break at word boundaries
      if (end < text.length) {
        const nextSpace = text.indexOf(' ', end)
        if (nextSpace !== -1 && nextSpace - end < 100) {
          end = nextSpace
        }
      }

      const chunkText = text.substring(start, end)
      
      if (chunkText.trim().length > 0) {
        chunks.push({
          id: `${Date.now()}_chunk_${chunkIndex}`,
          content: chunkText.trim(),
          index: chunkIndex
        })
        chunkIndex++
      }

      start = end - overlapSize
      if (start < 0) start = 0
    }

    return chunks
  }

  private async storeDocument(documentData: any): Promise<void> {
    const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8004'

    try {
      // 1. Update document record with extracted content + mark as completed
      await this.ingestionService.documentRepository.updateDocument({
        id: documentData.id,
        content: documentData.content,
        status: DocumentStatus.PROCESSED,
        embeddingStatus: EmbeddingStatus.COMPLETED,
        metadata: documentData.metadata ?? {},
      })

      // 2. Persist chunks + embeddings to Postgres
      for (const chunk of documentData.chunks) {
        await this.ingestionService.documentRepository.createChunk({
          id: chunk.id,
          documentId: documentData.id,
          chunkIndex: chunk.index,
          content: chunk.content,
          metadata: {
            startPosition: 0,
            endPosition: chunk.content.length,
            wordCount: chunk.content.split(/\s+/).length,
            tokenCount: Math.ceil(chunk.content.length / 4),
            overlapSize: 200,
          },
          embedding: chunk.embedding,
          embeddingModel: chunk.embeddingModel || 'nomic-embed-text',
          createdAt: new Date(),
        })
      }

      // 3. Upsert chunks into ChromaDB for vector search
      // IMPORTANT: Use the ChromaDB JS client with DefaultEmbeddingFunction
      // so that document embeddings match the query embeddings in RetrievalService.
      // We pass text (documents) instead of raw Ollama embeddings — the client
      // generates consistent embeddings using the same model as retrieval queries.
      const collectionName = `workspace_${documentData.workspaceId}_documents`
      const chromaClient = new ChromaClient({ path: chromaUrl })
      const embedder = new DefaultEmbeddingFunction()

      const collection = await chromaClient.getOrCreateCollection({
        name: collectionName,
        embeddingFunction: embedder,
      } as any)

      // Build chunk data with globally unique IDs (documentId prefix prevents collisions)
      const ids = documentData.chunks.map((c: any) => `${documentData.id}_${c.id}`)
      const documents = documentData.chunks.map((c: any) => c.content)
      const metadatas = documentData.chunks.map((c: any, i: number) => ({
        documentId: documentData.id,
        workspaceId: documentData.workspaceId,
        title: documentData.title,
        mimeType: documentData.mimeType,
        personId: documentData.personId || '',
        chunkIndex: i,
        totalChunks: documentData.chunks.length,
        embeddingModel: 'default',
        extractedAt: new Date().toISOString(),
        chunkSize: c.content.length,
        overlapSize: 200,
      }))

      // Let ChromaDB client generate embeddings from text (matches retrieval query model)
      await collection.upsert({
        ids,
        documents,
        metadatas,
      })

      logger.info({ documentId: documentData.id, workspaceId: documentData.workspaceId, chunkCount: documentData.chunks.length }, 'Chunks upserted to ChromaDB via client (DefaultEmbeddingFunction)')
    } catch (error) {
      logger.error({ documentId: documentData.id, err: error instanceof Error ? error.message : String(error) }, 'Failed to store document in Postgres/Chroma')
      throw error
    }
  }
}

// Worker startup
async function startWorker() {
  const worker = new IngestionWorker()
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT — shutting down ingestion worker gracefully')
    await worker.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM — shutting down ingestion worker gracefully')
    await worker.stop()
    process.exit(0)
  })

  try {
    await worker.start()
    logger.info('Ingestion worker ready to process jobs')
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : String(error) }, 'Failed to start ingestion worker')
    process.exit(1)
  }
}

// Start worker if this file is run directly
if (require.main === module) {
  startWorker().catch(console.error)
}

export { startWorker }
