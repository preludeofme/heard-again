import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { withMFAProtection, SENSITIVE_OPERATIONS } from '@/lib/security/mfa'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'

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

  // On RunPod, upload_reference stores the audio at voice-profiles/{familyspaceId}/{fileId}/.
  // synthesize_batch looks it up by profileName matching that same fileId.
  // No separate "create profile" call is needed — the upload IS the profile creation.
  const profileName = modelName || `voice_${Date.now()}`

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
      styleParams: null,
      status: 'READY',
      externalId: ttsFileId,
      sourceAssetId: asset.id,
    },
  })

  logger.info('[API] train: voice profile created', { profileId: profile.id, ttsFileId, assetId: asset.id })

  return successResponse(res, {
    jobId: ttsFileId,
    modelId: profile.id,
    dbProfileId: profile.id,
    ttsProfileId: ttsFileId,
    status: 'completed',
  })
}

export default apiHandler({
  POST: withMFAProtection(SENSITIVE_OPERATIONS.VOICE_TRAINING, trainVoiceHandler)
})
