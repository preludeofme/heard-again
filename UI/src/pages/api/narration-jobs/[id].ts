import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { getNarrationQueue, narrationDedupeKey } from '@/lib/queues/narrationQueue'

interface NarrationJobStatusResponse {
  success: boolean
  jobId: string
  storyId: string | null
  status: 'queued' | 'processing' | 'synthesizing' | 'saving' | 'completed' | 'failed'
  sentencesDone: number
  sentencesTotal: number
  assetId: string | null
  assetDownloadUrl: string | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  durationSeconds: number | null
}

type QueuePhase = 'queued' | 'loading' | 'synthesizing' | 'saving' | 'complete' | 'failed'
interface QueueProgressShape {
  phase?: QueuePhase
  sentencesDone?: number
  sentencesTotal?: number
  message?: string
}

function mapStatus(
  dbStatus: string,
  phase: QueuePhase | undefined
): NarrationJobStatusResponse['status'] {
  if (dbStatus === 'COMPLETED') return 'completed'
  if (dbStatus === 'FAILED') return 'failed'
  if (dbStatus === 'QUEUED') return 'queued'
  if (phase === 'synthesizing') return 'synthesizing'
  if (phase === 'saving') return 'saving'
  return 'processing'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  let user
  try {
    user = await getAuthUserWithFamilyspace(req, res)
  } catch {
    return
  }

  await requireFamilyspaceRole(user.id, user.familyspaceId, 'VIEWER')

  const jobId = req.query.id as string
  if (!jobId) {
    return res.status(400).json({ success: false, error: 'jobId is required' })
  }

  const dbJob = await prisma.voiceGenerationJob.findFirst({
    where: {
      id: jobId,
      story: { familyspaceId: user.familyspaceId },
    },
    select: {
      id: true,
      storyId: true,
      status: true,
      startedAt: true,
      completedAt: true,
      errorMessage: true,
      outputAssetId: true,
      durationSeconds: true,
      voiceProfileId: true,
    },
  })

  if (!dbJob) {
    return res.status(404).json({ success: false, error: 'Narration job not found' })
  }

  let phase: QueuePhase | undefined
  let sentencesDone = 0
  let sentencesTotal = 0

  if (dbJob.status !== 'COMPLETED' && dbJob.status !== 'FAILED' && dbJob.storyId) {
    try {
      const queue = getNarrationQueue()
      const dedupeKey = narrationDedupeKey(dbJob.storyId, dbJob.voiceProfileId)
      const queueJob = await queue.getJob(dedupeKey)
      if (queueJob) {
        const progress = queueJob.progress as QueueProgressShape | number | undefined
        if (progress && typeof progress === 'object') {
          phase = progress.phase
          sentencesDone = progress.sentencesDone ?? 0
          sentencesTotal = progress.sentencesTotal ?? 0
        }
      }
    } catch (err) {
      logger.warn('[narration-jobs] queue progress lookup failed (non-fatal)', { jobId, err })
    }
  }

  const status = mapStatus(dbJob.status, phase)
  const response: NarrationJobStatusResponse = {
    success: true,
    jobId: dbJob.id,
    storyId: dbJob.storyId,
    status,
    sentencesDone,
    sentencesTotal,
    assetId: dbJob.outputAssetId,
    assetDownloadUrl: dbJob.outputAssetId ? `/api/assets/${dbJob.outputAssetId}/download` : null,
    errorMessage: dbJob.errorMessage,
    startedAt: dbJob.startedAt ? dbJob.startedAt.toISOString() : null,
    completedAt: dbJob.completedAt ? dbJob.completedAt.toISOString() : null,
    durationSeconds: dbJob.durationSeconds,
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json(response)
}
