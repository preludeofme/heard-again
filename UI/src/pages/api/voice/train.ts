import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { apiHandler, Errors } from '@/lib/api-helpers'
import { voiceTrainingTask } from '@/trigger/voice-training-task'

/**
 * POST /api/voice/train
 *
 * Create a voice clone from uploaded audio samples.
 *
 * Because RunPod profile creation and sample synthesis can take 30–90 seconds
 * (triggering ERR_NETWORK_CHANGED in the browser), this endpoint now triggers
 * a Trigger.dev background task. It:
 *   1. Validates the request and creates the Prisma VoiceProfile record.
 *   2. Triggers the voiceTrainingTask in the background.
 *   3. Returns `{ status: 'processing', profileId }` immediately.
 *
 * The frontend polls /api/voice/profiles/[id] to detect completion
 * (when sampleAudioUrl is populated and status is 'READY').
 */
async function trainVoiceHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthUserWithFamilyspace(req, res)
  await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

  const { samples, language, modelName, styleInstruct, personId } = req.body as {
    samples?: string[]
    language?: string
    modelName?: string
    styleInstruct?: string
    personId?: string
  }

  if (!samples || !Array.isArray(samples) || samples.length === 0) {
    throw Errors.badRequest('No samples provided')
  }

  if (personId) {
    const person = await prisma.person.findFirst({
      where: { id: personId, familyspaceId: user.familyspaceId },
      select: { id: true },
    })
    if (!person) {
      throw Errors.notFound('Person')
    }
  }

  const primaryAssetId = samples[0]

  const asset = await prisma.asset.findUnique({
    where: { id: primaryAssetId },
    select: { id: true, processingStatus: true, metadata: true },
  })

  if (!asset) {
    throw Errors.notFound('Audio sample asset not found')
  }

  if (asset.processingStatus !== 'COMPLETED') {
    throw Errors.badRequest('Audio sample has not finished processing yet')
  }

  const metadata = typeof asset.metadata === 'object' && asset.metadata !== null
    ? (asset.metadata as Record<string, unknown>)
    : {}

  const ttsFileId = metadata.ttsFileId as string | undefined

  if (!ttsFileId) {
    logger.error('[API] train: asset missing ttsFileId in metadata', { assetId: asset.id, metadata })
    throw Errors.badRequest('Audio sample is missing voice reference data — please re-upload the sample')
  }

  const profileName = modelName || `voice_${Date.now()}`

  // ── Step A: Create Prisma VoiceProfile record ────────────────────────────
  const profile = await prisma.voiceProfile.create({
    data: {
      familyspaceId: user.familyspaceId,
      createdById: user.id,
      personId: personId ?? null,
      name: profileName,
      description: styleInstruct ?? null,
      isCloned: true,
      modelType: 'QWEN3_BASE',
      engineName: 'qwen3',
      engineVersion: language ?? 'English',
      styleParams: undefined,
      status: 'TRAINING',
      externalId: ttsFileId,
      sourceAssetId: asset.id,
    },
  })

  logger.info('[API] train: voice profile record created, triggering background task', {
    profileId: profile.id,
    ttsFileId,
  })

  // ── Step B: Trigger Trigger.dev voiceTrainingTask ────────────────────────
  await voiceTrainingTask.trigger({
    profileId: profile.id,
    ttsFileId,
    profileName,
    styleInstruct,
    familyspaceId: user.familyspaceId,
    userId: user.id,
  }, {
    idempotencyKey: `voice-train:profile:${profile.id}`,
    tags: [`profile:${profile.id}`, `family:${user.familyspaceId}`],
  })

  // ── Return immediately while work runs in background ────────────────────
  res.status(200).json({
    success: true,
    status: 'training',
    profileId: profile.id,
    ttsProfileId: ttsFileId,
  })
}

export default apiHandler({
  POST: trainVoiceHandler,
})
