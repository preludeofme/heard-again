import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { withMFAProtection, SENSITIVE_OPERATIONS } from '@/lib/security/mfa'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getTTSProvider } from '@/lib/tts'
import { storageService } from '@/services/StorageService'

const SAMPLE_TEXT = 'Hello, this is a sample of my digital voice. Thank you for preserving my story.'

async function generateVoiceSample(
  profileId: string,
  externalId: string,
  familyspaceId: string,
  userId: string
): Promise<void> {
  const ttsProvider = getTTSProvider()
  const ttsData = await ttsProvider.synthesizeBatch(
    externalId,
    SAMPLE_TEXT,
    familyspaceId,
    null,
    async () => {}
  )

  const audioBuffer = await ttsProvider.downloadAudio(ttsData.audioId, familyspaceId)

  const stored = await storageService.saveAudio(familyspaceId, ttsData.audioId, audioBuffer, {
    mimeType: 'audio/wav',
    extension: 'wav',
  })

  const fileName = ttsData.audioId.split('/').pop() ?? `${ttsData.audioId}.wav`

  const asset = await prisma.asset.create({
    data: {
      familyspaceId,
      filename: fileName,
      originalName: fileName,
      mimeType: 'audio/wav',
      sizeBytes: BigInt(audioBuffer.byteLength),
      storageType: 'LOCAL',
      storagePath: stored.path,
      assetType: 'GENERATED_AUDIO',
      isAISynthesized: true,
      processingStatus: 'COMPLETED',
      uploadedById: userId,
      durationSeconds: ttsData.duration ?? null,
      metadata: {
        source: 'voice.profile.sample',
        ttsAudioId: ttsData.audioId,
        voiceProfileId: profileId,
      },
    },
    select: { id: true },
  })

  await prisma.voiceProfile.update({
    where: { id: profileId },
    data: { sampleAudioUrl: `/api/assets/${asset.id}/download` },
  })

  logger.info('[API] train: sample audio generated', { profileId, assetId: asset.id })
}

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
      styleParams: undefined,
      status: 'READY',
      externalId: ttsFileId,
      sourceAssetId: asset.id,
    },
  })

  logger.info('[API] train: voice profile created', { profileId: profile.id, ttsFileId, assetId: asset.id })

  generateVoiceSample(profile.id, ttsFileId, user.familyspaceId, user.id).catch((err) => {
    logger.warn('[API] train: background sample generation failed', { profileId: profile.id, err })
  })

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
