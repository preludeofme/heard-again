import { Worker, Job } from 'bullmq'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { storageService } from '@/services/StorageService'
import { RETENTION_QUEUE, RetentionJobData } from '@/lib/queues/retentionQueue'
import { getQueueConnection } from '@/lib/queues/narrationQueue'

interface RetentionPolicy {
  audioRetentionDays: number
  transcriptRetentionDays: number
  inactiveStoryDraftRetentionDays: number
  purgeRevokedVoiceConsentsAfterDays: number
  autoDeleteFailedProcessingAfterDays: number
}

const DEFAULT_POLICY: RetentionPolicy = {
  audioRetentionDays: 3650,
  transcriptRetentionDays: 3650,
  inactiveStoryDraftRetentionDays: 365,
  purgeRevokedVoiceConsentsAfterDays: 365,
  autoDeleteFailedProcessingAfterDays: 30,
}

async function getWorkspacePolicy(workspaceId: string): Promise<RetentionPolicy> {
  const latest = await prisma.auditLog.findFirst({
    where: {
      workspaceId,
      action: 'privacy.retention.update',
      resourceType: 'workspace',
      resourceId: workspaceId,
    },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  })

  if (!latest?.metadata || typeof latest.metadata !== 'object') {
    return DEFAULT_POLICY
  }

  const metadata = latest.metadata as any
  const saved = metadata.policy

  return {
    ...DEFAULT_POLICY,
    ...(saved || {}),
  }
}

async function processRetention(job: Job<RetentionJobData>) {
  const { workspaceId, forceAll } = job.data
  
  if (workspaceId) {
    await enforcePolicyForWorkspace(workspaceId)
  } else if (forceAll) {
    const workspaces = await prisma.workspace.findMany({
      select: { id: true }
    })
    for (const ws of workspaces) {
      await enforcePolicyForWorkspace(ws.id)
    }
  }
}

async function enforcePolicyForWorkspace(workspaceId: string) {
  const policy = await getWorkspacePolicy(workspaceId)
  const now = new Date()

  logger.info({ workspaceId, policy }, 'Enforcing retention policy')

  // 1. Purge Old Audio Assets
  const audioCutoff = new Date(now.getTime() - policy.audioRetentionDays * 24 * 60 * 60 * 1000)
  const oldAssets = await prisma.asset.findMany({
    where: {
      workspaceId,
      assetType: { in: ['AUDIO', 'GENERATED_AUDIO'] },
      createdAt: { lt: audioCutoff }
    }
  })

  for (const asset of oldAssets) {
    logger.info({ assetId: asset.id, workspaceId }, 'Retention: Deleting old audio asset')
    try {
      await storageService.deleteFile(asset.storagePath)
      await prisma.asset.delete({ where: { id: asset.id } })
    } catch (err) {
      logger.error({ err, assetId: asset.id }, 'Failed to delete old asset')
    }
  }

  // 2. Purge Inactive Story Drafts
  const draftCutoff = new Date(now.getTime() - policy.inactiveStoryDraftRetentionDays * 24 * 60 * 60 * 1000)
  const inactiveDrafts = await prisma.story.findMany({
    where: {
      workspaceId,
      status: 'DRAFT',
      updatedAt: { lt: draftCutoff }
    },
    select: { id: true }
  })

  for (const story of inactiveDrafts) {
    logger.info({ storyId: story.id, workspaceId }, 'Retention: Deleting inactive story draft')
    await prisma.story.delete({ where: { id: story.id } })
  }

  // 3. Purge Failed Processing Assets
  const failedCutoff = new Date(now.getTime() - policy.autoDeleteFailedProcessingAfterDays * 24 * 60 * 60 * 1000)
  const failedAssets = await prisma.asset.findMany({
    where: {
      workspaceId,
      processingStatus: 'FAILED',
      createdAt: { lt: failedCutoff }
    }
  })

  for (const asset of failedAssets) {
    logger.info({ assetId: asset.id, workspaceId }, 'Retention: Deleting failed asset')
    try {
      if (asset.storagePath) await storageService.deleteFile(asset.storagePath)
      await prisma.asset.delete({ where: { id: asset.id } })
    } catch (err) {
      logger.error({ err, assetId: asset.id }, 'Failed to delete failed asset')
    }
  }
}

export const retentionWorker = new Worker(
  RETENTION_QUEUE,
  processRetention,
  { connection: getQueueConnection() }
)

retentionWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Retention job completed')
})

retentionWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Retention job failed')
})
