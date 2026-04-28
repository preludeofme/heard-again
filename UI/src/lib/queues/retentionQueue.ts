import { Queue } from 'bullmq'
import { getQueueConnection } from './narrationQueue'

export const RETENTION_QUEUE = 'retention-enforcement'

export interface RetentionJobData {
  workspaceId?: string
  forceAll?: boolean
}

export const retentionQueue = new Queue(RETENTION_QUEUE, {
  connection: getQueueConnection()
})
