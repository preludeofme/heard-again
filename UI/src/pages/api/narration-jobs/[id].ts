import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { runs } from '@trigger.dev/sdk/v3'
import type { NarrationTaskProgress } from '@/trigger/narration-task'

interface NarrationJobStatusResponse {
  success: boolean
  jobId: string
  storyId: string | null
  status: 'queued' | 'processing' | 'synthesizing' | 'saving' | 'completed' | 'failed'
  /** @deprecated Use chunksDone instead */
  sentencesDone: number
  /** @deprecated Use chunksTotal instead */
  sentencesTotal: number
  chunksDone: number
  chunksTotal: number
  assetId: string | null
  assetDownloadUrl: string | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  durationSeconds: number | null
}

function mapStatus(
  dbStatus: string,
  triggerStatus: string | undefined,
  phase: NarrationTaskProgress['phase'] | undefined
): NarrationJobStatusResponse['status'] {
  if (dbStatus === 'COMPLETED') return 'completed'
  if (dbStatus === 'FAILED' || dbStatus === 'CANCELLED') return 'failed'
  if (triggerStatus === 'FAILED' || triggerStatus === 'CRASHED') return 'failed'
  if (phase === 'synthesizing') return 'synthesizing'
  if (phase === 'saving') return 'saving'
  if (dbStatus === 'QUEUED') return 'queued'
  return 'processing'
}

async function handleCancel(req: NextApiRequest, res: NextApiResponse) {
  let user
  try {
    user = await getAuthUserWithFamilyspace(req, res)
  } catch {
    return
  }
  await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

  const jobId = req.query.id as string

  const dbJob = await prisma.voiceGenerationJob.findFirst({
    where: { id: jobId, story: { familyspaceId: user.familyspaceId } },
    select: { id: true, status: true, storyId: true, triggerRunId: true },
  })

  if (!dbJob) {
    return res.status(404).json({ success: false, error: 'Narration job not found' })
  }

  if (dbJob.status === 'COMPLETED') {
    return res.status(409).json({ success: false, error: 'Job is already completed' })
  }
  if (dbJob.status === 'CANCELLED') {
    return res.status(200).json({ success: true, cancelled: true })
  }

  await prisma.$transaction([
    prisma.voiceGenerationJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    }),
    prisma.story.updateMany({
      where: { id: dbJob.storyId ?? '', narrationRenderJobId: jobId },
      data: { narrationRenderJobId: null },
    }),
  ])

  if (dbJob.triggerRunId) {
    await runs.cancel(dbJob.triggerRunId).catch((err) => {
      logger.warn('[narration-jobs] Trigger.dev cancel failed (non-fatal)', { jobId, err })
    })
  }

  return res.status(200).json({ success: true, cancelled: true })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'DELETE') return handleCancel(req, res)

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'DELETE'])
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
      triggerRunId: true,
    },
  })

  if (!dbJob) {
    return res.status(404).json({ success: false, error: 'Narration job not found' })
  }

  let phase: NarrationTaskProgress['phase'] | undefined
  let chunksDone = 0
  let chunksTotal = 0
  let triggerStatus: string | undefined

  const isTerminal =
    dbJob.status === 'COMPLETED' || dbJob.status === 'FAILED' || dbJob.status === 'CANCELLED'

  if (!isTerminal && dbJob.triggerRunId) {
    try {
      const run = await runs.retrieve(dbJob.triggerRunId)
      triggerStatus = run.status

      const progress = run.metadata?.progress as NarrationTaskProgress | undefined
      if (progress) {
        phase = progress.phase
        // Prefer chunksDone/chunksTotal; fall back to legacy sentencesDone/sentencesTotal
        chunksDone = progress.chunksDone ?? progress.sentencesDone ?? 0
        chunksTotal = progress.chunksTotal ?? progress.sentencesTotal ?? 0
      }
    } catch (err) {
      logger.warn('[narration-jobs] Trigger.dev run retrieve failed (non-fatal)', { jobId, err })
    }
  }

  const status = mapStatus(dbJob.status, triggerStatus, phase)
  const response: NarrationJobStatusResponse = {
    success: true,
    jobId: dbJob.id,
    storyId: dbJob.storyId,
    status,
    sentencesDone: chunksDone,
    sentencesTotal: chunksTotal,
    chunksDone,
    chunksTotal,
    assetId: dbJob.outputAssetId,
    assetDownloadUrl: dbJob.outputAssetId ? `/api/assets/serve/${dbJob.outputAssetId}` : null,
    errorMessage: dbJob.errorMessage,
    startedAt: dbJob.startedAt?.toISOString() ?? null,
    completedAt: dbJob.completedAt?.toISOString() ?? null,
    durationSeconds: dbJob.durationSeconds,
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json(response)
}
