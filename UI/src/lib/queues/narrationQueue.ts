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

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

let sharedConnection: IORedis | null = null
export function getQueueConnection(): IORedis {
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

export async function enqueueNarrationRender(
  data: NarrationRenderJobData,
  options: JobsOptions = {}
): Promise<string> {
  const queue = getNarrationQueue()
  const jobId = narrationDedupeKey(data.storyId, data.voiceProfileId)

  const existing = await queue.getJob(jobId)
  if (existing) {
    const state = await existing.getState()
    if (state === 'active' || state === 'waiting' || state === 'delayed') {
      return existing.id ?? jobId
    }
    await existing.remove().catch(() => undefined)
  }

  const job = await queue.add(NARRATION_RENDER_JOB, data, {
    jobId,
    ...options,
  })
  return job.id ?? jobId
}
