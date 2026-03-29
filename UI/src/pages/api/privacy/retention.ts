import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

interface RetentionPolicy {
  audioRetentionDays: number
  transcriptRetentionDays: number
  inactiveStoryDraftRetentionDays: number
  purgeRevokedVoiceConsentsAfterDays: number
  autoDeleteFailedProcessingAfterDays: number
  deleteSourceAudioAfterProfileReady: boolean
  updatedAt: string | null
  updatedByUserId: string | null
}

const defaultPolicy: RetentionPolicy = {
  audioRetentionDays: 3650,
  transcriptRetentionDays: 3650,
  inactiveStoryDraftRetentionDays: 365,
  purgeRevokedVoiceConsentsAfterDays: 365,
  autoDeleteFailedProcessingAfterDays: 30,
  deleteSourceAudioAfterProfileReady: false,
  updatedAt: null,
  updatedByUserId: null,
}

function toPolicyPayload(policy: RetentionPolicy) {
  return {
    audioRetentionDays: policy.audioRetentionDays,
    transcriptRetentionDays: policy.transcriptRetentionDays,
    inactiveStoryDraftRetentionDays: policy.inactiveStoryDraftRetentionDays,
    purgeRevokedVoiceConsentsAfterDays: policy.purgeRevokedVoiceConsentsAfterDays,
    autoDeleteFailedProcessingAfterDays: policy.autoDeleteFailedProcessingAfterDays,
    deleteSourceAudioAfterProfileReady: policy.deleteSourceAudioAfterProfileReady,
  }
}

function normalizePolicy(input: any, current: RetentionPolicy): RetentionPolicy {
  const toInt = (value: any, min: number, max: number, field: string, fallback: number) => {
    if (value === undefined) return fallback
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw Errors.badRequest(`${field} must be an integer between ${min} and ${max}`)
    }
    return parsed
  }

  const next: RetentionPolicy = {
    ...current,
    audioRetentionDays: toInt(input.audioRetentionDays, 1, 36500, 'audioRetentionDays', current.audioRetentionDays),
    transcriptRetentionDays: toInt(input.transcriptRetentionDays, 1, 36500, 'transcriptRetentionDays', current.transcriptRetentionDays),
    inactiveStoryDraftRetentionDays: toInt(input.inactiveStoryDraftRetentionDays, 1, 36500, 'inactiveStoryDraftRetentionDays', current.inactiveStoryDraftRetentionDays),
    purgeRevokedVoiceConsentsAfterDays: toInt(input.purgeRevokedVoiceConsentsAfterDays, 1, 36500, 'purgeRevokedVoiceConsentsAfterDays', current.purgeRevokedVoiceConsentsAfterDays),
    autoDeleteFailedProcessingAfterDays: toInt(input.autoDeleteFailedProcessingAfterDays, 1, 36500, 'autoDeleteFailedProcessingAfterDays', current.autoDeleteFailedProcessingAfterDays),
    deleteSourceAudioAfterProfileReady:
      input.deleteSourceAudioAfterProfileReady === undefined
        ? current.deleteSourceAudioAfterProfileReady
        : Boolean(input.deleteSourceAudioAfterProfileReady),
  }

  return next
}

async function readPolicy(workspaceId: string): Promise<RetentionPolicy> {
  const latest = await prisma.auditLog.findFirst({
    where: {
      workspaceId,
      action: 'privacy.retention.update',
      resourceType: 'workspace',
      resourceId: workspaceId,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      metadata: true,
      createdAt: true,
      actorId: true,
    },
  })

  if (!latest?.metadata || typeof latest.metadata !== 'object') {
    return defaultPolicy
  }

  const metadata = latest.metadata as any
  const saved = metadata.policy

  if (!saved || typeof saved !== 'object') {
    return defaultPolicy
  }

  return {
    ...defaultPolicy,
    ...saved,
    updatedAt: latest.createdAt.toISOString(),
    updatedByUserId: latest.actorId || null,
  }
}

export default apiHandler({
  // GET /api/privacy/retention - Get workspace retention policy
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'VIEWER')

    const policy = await readPolicy(user.workspaceId)

    return successResponse(res, {
      workspaceId: user.workspaceId,
      policy,
    })
  },

  // PUT /api/privacy/retention - Update workspace retention policy
  PUT: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'ADMIN')

    const currentPolicy = await readPolicy(user.workspaceId)
    const nextPolicy = normalizePolicy(req.body || {}, currentPolicy)
    const currentPolicyPayload = toPolicyPayload(currentPolicy)
    const nextPolicyPayload = toPolicyPayload(nextPolicy)

    await prisma.auditLog.create({
      data: {
        workspaceId: user.workspaceId,
        actorId: user.id,
        actorType: 'USER',
        action: 'privacy.retention.update',
        resourceType: 'workspace',
        resourceId: user.workspaceId,
        beforeState: { policy: currentPolicyPayload },
        afterState: { policy: nextPolicyPayload },
        metadata: {
          version: 1,
          policy: nextPolicyPayload,
        },
      },
    })

    return successResponse(res, {
      workspaceId: user.workspaceId,
      policy: {
        ...nextPolicy,
        updatedAt: new Date().toISOString(),
        updatedByUserId: user.id,
      },
    })
  },
})
