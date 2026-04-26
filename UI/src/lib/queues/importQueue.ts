import { Queue, Worker, Job } from 'bullmq'
import { redis } from '../redis-client'
import { gedcomImportService } from '@/server/services/gedcom/GedcomImportService'
import { logger } from '../logger'

const QUEUE_NAME = 'import-queue'

export const importQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
  },
})

export interface ImportJobData {
  workspaceId: string
  userId: string
  filePath: string
  assetId: string
  jobId: string
  importType: 'GEDCOM'
}

export function startImportWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job<ImportJobData>) => {
      const { workspaceId, userId, filePath, assetId, jobId, importType } = job.data
      logger.info(`Starting background import job ${job.id} type=${importType}`)

      try {
        if (importType === 'GEDCOM') {
          await gedcomImportService.importGedcom(workspaceId, userId, filePath, assetId, jobId)
        } else {
          throw new Error(`Unsupported import type: ${importType}`)
        }
        logger.info(`Import job ${job.id} completed successfully`)
      } catch (error: any) {
        logger.error(`Import job ${job.id} failed: ${error.message}`)
        throw error
      }
    },
    { connection: redis }
  )

  worker.on('failed', (job, err) => {
    logger.error(`Import job ${job?.id} failed with error: ${err.message}`)
  })

  return worker
}
