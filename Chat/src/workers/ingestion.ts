import { Worker } from 'bullmq'
import { queueManager, QUEUE_NAMES, JobUtils } from '@/utils/queues'
import { SimpleIngestionService, SimpleDocumentProcessor } from '@/services/ingestion/SimpleIngestionService'
import { EmbeddingGeneratorImpl } from '@/services/ingestion/EmbeddingGenerator'
import { PrismaDocumentRepository } from '@/repositories/DocumentRepository'

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
    console.log('🚀 Starting ingestion worker...')

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
    this.worker.on('completed', (job) => {
      console.log(`✅ Job ${job.id} completed successfully`)
    })

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Job ${job?.id} failed:`, err)
    })

    this.worker.on('error', (err) => {
      console.error('Worker error:', err)
    })

    console.log('✅ Ingestion worker started successfully')
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close()
      this.worker = null
      console.log('🛑 Ingestion worker stopped')
    }
  }

  private async processJob(job: any): Promise<any> {
    const { documentId, filePath, workspaceId, userId, config, traceId } = job.data

    console.log(`📄 Processing document ${documentId} (trace: ${traceId})`)

    try {
      // Step 1: Extract text
      await JobUtils.updateJobProgress(job, {
        currentStep: 'extracting_text',
        totalSteps: 5,
        completedSteps: 0,
        currentOperation: 'Reading file and extracting text content'
      })

      const fs = require('fs').promises
      const path = require('path')
      const buffer = await fs.readFile(filePath)
      
      // Determine MIME type
      const mimeType = this.getMimeTypeFromPath(filePath)
      
      // Extract text using document processor
      const textResult = await this.documentProcessor.extractText(buffer, mimeType)
      
      if (!textResult.text || textResult.text.trim().length === 0) {
        throw new Error('No text content extracted from document')
      }

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
      
      await JobUtils.updateJobProgress(job, {
        currentStep: 'generating_embeddings',
        totalSteps: 5,
        completedSteps: 3,
        currentOperation: 'Creating vector embeddings for chunks'
      })

      // Step 4: Generate embeddings
      const embeddingGenerator = new EmbeddingGeneratorImpl()
      const chunkTexts = chunks.map(chunk => chunk.content)
      const embeddings = await embeddingGenerator.generateEmbeddings(chunkTexts)

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
        title: path.basename(filePath),
        content: textResult.text,
        mimeType,
        chunks: chunks.map((chunk, index) => ({
          ...chunk,
          embedding: embeddings[index],
          embeddingModel: 'nomic-embed-text'
        })),
        structure,
        metadata: {
          originalFileName: path.basename(filePath),
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
        console.warn(`Failed to cleanup temporary file ${filePath}:`, error)
      }

      await JobUtils.updateJobProgress(job, {
        currentStep: 'completed',
        totalSteps: 5,
        completedSteps: 5,
        currentOperation: 'Document processing completed successfully'
      })

      console.log(`✅ Document ${documentId} processed successfully`)
      
      return {
        success: true,
        documentId,
        chunksProcessed: chunks.length,
        embeddingsGenerated: embeddings.length,
        processingTime: Date.now() - job.timestamp
      }

    } catch (error) {
      await JobUtils.addJobError(job, error instanceof Error ? error.message : 'Unknown error')
      
      console.error(`❌ Failed to process document ${documentId}:`, error)
      
      // Clean up temporary file on error
      try {
        const fs = require('fs').promises
        await fs.unlink(filePath)
      } catch (cleanupError) {
        // Ignore cleanup errors
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
          id: `chunk_${chunkIndex}`,
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
    // TODO: Implement database storage
    // This would store the document and chunks in the database
    // and also add them to ChromaDB for vector search
    console.log(`📚 Storing document ${documentData.id} with ${documentData.chunks.length} chunks`)
    
    // Mock implementation
    return new Promise((resolve) => {
      setTimeout(resolve, 100) // Simulate database operation
    })
  }
}

// Worker startup
async function startWorker() {
  const worker = new IngestionWorker()
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down worker gracefully...')
    await worker.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down worker gracefully...')
    await worker.stop()
    process.exit(0)
  })

  try {
    await worker.start()
    console.log('🎉 Worker is ready to process jobs')
  } catch (error) {
    console.error('❌ Failed to start worker:', error)
    process.exit(1)
  }
}

// Start worker if this file is run directly
if (require.main === module) {
  startWorker().catch(console.error)
}

export { startWorker }
