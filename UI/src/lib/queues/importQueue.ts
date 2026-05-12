import { Queue, Worker, Job } from 'bullmq'
import { getRedisConnection } from '../redis-client'
import { gedcomImportService } from '@/server/services/gedcom/GedcomImportService'
import { logger } from '../logger'

const QUEUE_NAME = 'import-queue'

const connection = getRedisConnection()

export const importQueue = connection
  ? new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
      },
    })
  : null

export interface ImportJobData {
  familyspaceId: string
  userId: string
  filePath: string
  assetId: string
  jobId: string
  importType: 'GEDCOM'
  options?: {
    linkToPersonId?: string
    gedcomXrefForLink?: string
    motherXref?: string
    fatherXref?: string
  }
}

export function startImportWorker() {
  const conn = getRedisConnection()
  if (!conn) {
    logger.warn('[importQueue] Redis not configured — import worker disabled')
    return null
  }

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job<ImportJobData>) => {
      const { familyspaceId, userId, filePath, assetId, jobId, importType, options } = job.data
      logger.info(`Starting background import job ${job.id} type=${importType}`)

      try {
        if (importType === 'GEDCOM') {
          await gedcomImportService.importGedcom(familyspaceId, userId, filePath, assetId, jobId, options)
        } else {
          throw new Error(`Unsupported import type: ${importType}`)
        }
        logger.info(`Import job ${job.id} completed successfully`)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`Import job ${job.id} failed: ${message}`)
        throw error
      }
    },
    { connection: conn }
  )

  worker.on('failed', (job, err) => {
    logger.error(`Import job ${job?.id} failed with error: ${err.message}`)
  })

  return worker
}
