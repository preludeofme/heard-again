import { Queue, QueueEvents, JobsOptions } from 'bullmq'
import IORedis from 'ioredis'

export const NARRATION_QUEUE = 'narration'
export const NARRATION_RENDER_JOB = 'render'

export interface NarrationRenderJobData {
  storyId: string
  familyspaceId: string
  voiceProfileId: string
  userId: string
  voiceGenerationJobId: string
}

export interface NarrationRenderJobProgress {
  phase: 'queued' | 'loading' | 'synthesizing' | 'saving' | 'complete' | 'failed'
  sentencesDone: number
  sentencesTotal: number
  message?: string
}

const REDIS_URL = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL

export function isQueueAvailable(): boolean {
  return !!REDIS_URL
}

let sharedConnection: IORedis | null = null
export function getQueueConnection(): IORedis {
  if (!REDIS_URL) throw new Error('Redis is not configured — narration queue unavailable')
  if (!sharedConnection) {
    sharedConnection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
  }
  return sharedConnection
}

let queueInstance: Queue<NarrationRenderJobData> | null = null
export function getNarrationQueue(): Queue<NarrationRenderJobData> {
  if (!queueInstance) {
    queueInstance = new Queue<NarrationRenderJobData>(NARRATION_QUEUE, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100, age: 60 * 60 * 24 * 7 },
        removeOnFail: { count: 100, age: 60 * 60 * 24 * 30 },
      },
    })
  }
  return queueInstance
}

let queueEventsInstance: QueueEvents | null = null
export function getNarrationQueueEvents(): QueueEvents {
  if (!queueEventsInstance) {
    queueEventsInstance = new QueueEvents(NARRATION_QUEUE, {
      connection: getQueueConnection(),
    })
  }
  return queueEventsInstance
}

export function narrationDedupeKey(storyId: string, voiceProfileId: string): string {
  return `narration:render:${storyId}:${voiceProfileId}`
}

export interface EnqueueResult {
  queueJobId: string
  deduped: boolean
  /** When deduped, the voiceGenerationJobId of the already-running job. */
  existingVoiceGenerationJobId?: string
}

/**
 * Remove the BullMQ job for a given (storyId, voiceProfileId) pair regardless of state.
 * Used by the cancel endpoint and stale-job cleanup to fully evict a stuck job from Redis.
 */
export async function removeNarrationQueueJob(
  storyId: string,
  voiceProfileId: string
): Promise<boolean> {
  const queue = getNarrationQueue()
  const jobId = narrationDedupeKey(storyId, voiceProfileId)
  const existing = await queue.getJob(jobId).catch(() => null)
  if (!existing) return false
  await existing.remove().catch(() => undefined)
  return true
}

export async function enqueueNarrationRender(
  data: NarrationRenderJobData,
  options: JobsOptions = {}
): Promise<EnqueueResult> {
  if (!isQueueAvailable()) throw new Error('Narration queue is not available in this environment')
  const queue = getNarrationQueue()
  const jobId = narrationDedupeKey(data.storyId, data.voiceProfileId)

  const existing = await queue.getJob(jobId)
  if (existing) {
    const state = await existing.getState()
    // Only dedup truly in-flight jobs. 'delayed' means a retry is pending — the
    // first attempt already failed, so let the user restart fresh instead of
    // returning the failed job's ID and showing a cached error immediately.
    if (state === 'active' || state === 'waiting') {
      return {
        queueJobId: existing.id ?? jobId,
        deduped: true,
        existingVoiceGenerationJobId: existing.data.voiceGenerationJobId,
      }
    }
    await existing.remove().catch(() => undefined)
  }

  const job = await queue.add(NARRATION_RENDER_JOB, data, {
    jobId,
    ...options,
  })
  return { queueJobId: job.id ?? jobId, deduped: false }
}
