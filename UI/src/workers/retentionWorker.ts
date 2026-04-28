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
  audioRetentionDays: 0,
  transcriptRetentionDays: 0,
  inactiveStoryDraftRetentionDays: 365,
  purgeRevokedVoiceConsentsAfterDays: 365,
  autoDeleteFailedProcessingAfterDays: 30,
}

async function getFamilyspacePolicy(familyspaceId: string): Promise<RetentionPolicy> {
  const latest = await prisma.auditLog.findFirst({
    where: {
      familyspaceId,
      action: 'privacy.retention.update',
      resourceType: 'familyspace',
      resourceId: familyspaceId,
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
  const { familyspaceId, forceAll } = job.data
  
  if (familyspaceId) {
    await enforcePolicyForFamilyspace(familyspaceId)
  } else if (forceAll) {
    const familyspaces = await prisma.familyspace.findMany({
      select: { id: true }
    })
    for (const ws of familyspaces) {
      await enforcePolicyForFamilyspace(ws.id)
    }
  }
}

async function enforcePolicyForFamilyspace(familyspaceId: string) {
  const policy = await getFamilyspacePolicy(familyspaceId)
  const now = new Date()

  logger.info({ familyspaceId, policy }, 'Enforcing retention policy')

  // 1. Purge Old Audio Assets
  if (policy.audioRetentionDays > 0) {
    const audioCutoff = new Date(now.getTime() - policy.audioRetentionDays * 24 * 60 * 60 * 1000)
    const oldAssets = await prisma.asset.findMany({
      where: {
        familyspaceId,
        assetType: { in: ['AUDIO', 'GENERATED_AUDIO'] },
        createdAt: { lt: audioCutoff }
      }
    })

    for (const asset of oldAssets) {
      logger.info({ assetId: asset.id, familyspaceId }, 'Retention: Deleting old audio asset')
      try {
        await storageService.deleteFile(asset.storagePath)
        await prisma.asset.delete({ where: { id: asset.id } })
      } catch (err) {
        logger.error({ err, assetId: asset.id }, 'Failed to delete old asset')
      }
    }
  }

  // 2. Purge Inactive Story Drafts
  if (policy.inactiveStoryDraftRetentionDays > 0) {
    const draftCutoff = new Date(now.getTime() - policy.inactiveStoryDraftRetentionDays * 24 * 60 * 60 * 1000)
    const inactiveDrafts = await prisma.story.findMany({
      where: {
        familyspaceId,
        status: 'DRAFT',
        updatedAt: { lt: draftCutoff }
      },
      select: { id: true }
    })

    for (const story of inactiveDrafts) {
      logger.info({ storyId: story.id, familyspaceId }, 'Retention: Deleting inactive story draft')
      await prisma.story.delete({ where: { id: story.id } })
    }
  }

  // 3. Purge Failed Processing Assets
  if (policy.autoDeleteFailedProcessingAfterDays > 0) {
    const failedCutoff = new Date(now.getTime() - policy.autoDeleteFailedProcessingAfterDays * 24 * 60 * 60 * 1000)
    const failedAssets = await prisma.asset.findMany({
      where: {
        familyspaceId,
        processingStatus: 'FAILED',
        createdAt: { lt: failedCutoff }
      }
    })

    for (const asset of failedAssets) {
      logger.info({ assetId: asset.id, familyspaceId }, 'Retention: Deleting failed asset')
      try {
        if (asset.storagePath) await storageService.deleteFile(asset.storagePath)
        await prisma.asset.delete({ where: { id: asset.id } })
      } catch (err) {
        logger.error({ err, assetId: asset.id }, 'Failed to delete failed asset')
      }
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
