import { Queue, Worker, ConnectionOptions } from 'bullmq'
import Redis from 'ioredis'

// Redis connection configuration
const redisConfig: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  lazyConnect: true,
}

// Create Redis connection
export const redisConnection = new Redis(redisConfig)

// Queue names
export const QUEUE_NAMES = {
  DOCUMENT_INGESTION: 'document-ingestion',
  TEXT_EXTRACTION: 'text-extraction',
  CHUNKING: 'chunking',
  EMBEDDING_GENERATION: 'embedding-generation',
  INDEXING: 'indexing',
  PERSONA_GENERATION: 'persona-generation',
  STYLE_EXTRACTION: 'style-extraction',
  AUDIO_PROCESSING: 'audio-processing',
} as const

// Queue configuration
export class QueueManager {
  private queues: Map<string, Queue> = new Map()
  private workers: Map<string, Worker> = new Map()
  // Create a new queue
  createQueue(name: string, options?: any): Queue {
    if (this.queues.has(name)) {
      return this.queues.get(name)!
    }

    const queue = new Queue(name, {
      connection: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
      ...options,
    })

    this.queues.set(name, queue)
    return queue
  }

  // Create a worker for a queue
  createWorker(name: string, processor: (job: any) => Promise<any>, options?: any): Worker {
    if (this.workers.has(name)) {
      return this.workers.get(name)!
    }

    const worker = new Worker(
      name,
      processor,
      {
        connection: redisConfig,
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
        ...options,
      }
    )

    this.workers.set(name, worker)
    return worker
  }

  // Get a queue by name
  getQueue(name: string): Queue | undefined {
    return this.queues.get(name)
  }

  // Get a worker by name
  getWorker(name: string): Worker | undefined {
    return this.workers.get(name)
  }

  // Close all connections
  async closeAll(): Promise<void> {
    const closePromises: Promise<any>[] = []

    this.queues.forEach(queue => closePromises.push(queue.close()))
    this.workers.forEach(worker => closePromises.push(worker.close()))

    await Promise.all(closePromises)
    this.queues.clear()
    this.workers.clear()
  }

  // Get queue statistics
  async getQueueStats(name: string): Promise<any> {
    const queue = this.getQueue(name)
    if (!queue) {
      throw new Error(`Queue ${name} not found`)
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ])

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    }
  }

  // Pause a queue
  async pauseQueue(name: string): Promise<void> {
    const queue = this.getQueue(name)
    if (queue) {
      await queue.pause()
    }
  }

  // Resume a queue
  async resumeQueue(name: string): Promise<void> {
    const queue = this.getQueue(name)
    if (queue) {
      await queue.resume()
    }
  }

  // Clear a queue
  async clearQueue(name: string): Promise<void> {
    const queue = this.getQueue(name)
    if (queue) {
      await queue.drain()
    }
  }
}

// Global queue manager instance
export const queueManager = new QueueManager()

// Job types and interfaces
export interface BaseJobData {
  familyspaceId: string
  userId: string
  traceId?: string
}

export interface DocumentIngestionJobData extends BaseJobData {
  documentId: string
  originalFileName: string
  mimeType: string
  fileSize: number
  config: {
    chunkSize?: number
    overlapSize?: number
    embeddingModel?: string
    enableOCR?: boolean
  }
}

export interface TextExtractionJobData extends BaseJobData {
  documentId: string
  filePath: string
  mimeType: string
}

export interface ChunkingJobData extends BaseJobData {
  documentId: string
  text: string
  config: {
    chunkSize: number
    overlapSize: number
  }
}

export interface EmbeddingGenerationJobData extends BaseJobData {
  documentId: string
  chunks: Array<{
    id: string
    content: string
    index: number
  }>
  embeddingModel: string
}

export interface PersonaGenerationJobData extends BaseJobData {
  personId: string
  documentIds: string[]
  config: {
    extractStyle: boolean
    extractFacts: boolean
    extractRelationships: boolean
    minDocumentCount: number
    confidenceThreshold: number
  }
}

// Job progress tracking
export interface JobProgress {
  currentStep: string
  totalSteps: number
  completedSteps: number
  percentage: number
  estimatedTimeRemaining?: number
  currentOperation?: string
  errors?: string[]
}

// Utility functions for job management
export class JobUtils {
  static async updateJobProgress(
    job: any,
    progress: Partial<JobProgress>
  ): Promise<void> {
    const currentProgress = job.progress || {}
    const updatedProgress = {
      ...currentProgress,
      ...progress,
      percentage: Math.round(
        ((progress.completedSteps || 0) / (progress.totalSteps || 1)) * 100
      ),
    }

    await job.updateProgress(updatedProgress)
  }

  static async addJobError(job: any, error: string): Promise<void> {
    const currentProgress = job.progress || {}
    const errors = currentProgress.errors || []
    errors.push(error)

    await job.updateProgress({
      ...currentProgress,
      errors,
    })
  }

  static createJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  static calculateEstimatedTimeRemaining(
    startTime: number,
    completedSteps: number,
    totalSteps: number
  ): number {
    if (completedSteps === 0) return 0

    const elapsed = Date.now() - startTime
    const averageTimePerStep = elapsed / completedSteps
    const remainingSteps = totalSteps - completedSteps

    return Math.round(averageTimePerStep * remainingSteps)
  }
}

// Queue health monitoring
export class QueueHealthMonitor {
  private healthChecks: Map<string, NodeJS.Timeout> = new Map()

  startHealthCheck(queueName: string, intervalMs = 30000): void {
    if (this.healthChecks.has(queueName)) {
      return // Already monitoring
    }

    const interval = setInterval(async () => {
      try {
        const stats = await queueManager.getQueueStats(queueName)
        
        // Log queue statistics
        console.log(`Queue ${queueName} stats:`, stats)

        // Alert if too many failed jobs
        if (stats.failed > 10) {
          console.warn(`Queue ${queueName} has ${stats.failed} failed jobs`)
        }

        // Alert if queue is backed up
        if (stats.waiting > 100) {
          console.warn(`Queue ${queueName} has ${stats.waiting} waiting jobs`)
        }
      } catch (error) {
        console.error(`Health check failed for queue ${queueName}:`, error)
      }
    }, intervalMs)

    this.healthChecks.set(queueName, interval)
  }

  stopHealthCheck(queueName: string): void {
    const interval = this.healthChecks.get(queueName)
    if (interval) {
      clearInterval(interval)
      this.healthChecks.delete(queueName)
    }
  }

  stopAllHealthChecks(): void {
    this.healthChecks.forEach(interval => clearInterval(interval))
    this.healthChecks.clear()
  }
}

export const queueHealthMonitor = new QueueHealthMonitor()
