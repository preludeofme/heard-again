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
  ttsProfileName: string,
  familyspaceId: string,
  userId: string
): Promise<{ assetId: string; url: string }> {
  const ttsProvider = getTTSProvider()

  // Step 1: Synthesise a sample using the cloned voice profile (the .pt file
  // on the TTS service). This produces audio from the actual cloned voice,
  // not from the design reference clip.
  const ttsData = await ttsProvider.synthesizeBatch(
    ttsProfileName,
    SAMPLE_TEXT,
    familyspaceId,
    null,
    async () => {}
  )

  // Step 2: Download the raw audio buffer from TTS
  const audioBuffer = await ttsProvider.downloadAudio(ttsData.audioId, familyspaceId)

  // Step 3: Save to storage (local filesystem or R2)
  const stored = await storageService.saveAudio(familyspaceId, ttsData.audioId, audioBuffer, {
    mimeType: 'audio/wav',
    extension: 'wav',
  })

  const fileName = ttsData.audioId.split('/').pop() ?? `${ttsData.audioId}.wav`

  // Step 4: Create Prisma Asset record
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

  // Step 5: Update VoiceProfile with sample URL pointing to the Asset API.
  // Use /api/assets/serve which handles both local and cloud storage.
  const sampleUrl = `/api/assets/serve/${asset.id}`
  await prisma.voiceProfile.update({
    where: { id: profileId },
    data: { sampleAudioUrl: sampleUrl },
  })

  logger.info('[API] train: sample audio generated', { profileId, assetId: asset.id })
  return { assetId: asset.id, url: sampleUrl }
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

  const ttsProvider = getTTSProvider()

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
      status: 'READY',
      externalId: ttsFileId,
      sourceAssetId: asset.id,
    },
  })

  // ── Step B: Create the .pt voice profile on the TTS service ─────────────
  let ttsProfileName = ttsFileId
  if (ttsProvider.createVoiceProfile) {
    try {
      const { profileId } = await ttsProvider.createVoiceProfile(
        ttsFileId,
        profileName,
        styleInstruct
      )
      ttsProfileName = profileId
      logger.info('[API] train: .pt voice profile created', { profileId, ttsFileId })
    } catch (err) {
      // Clean up the prisma record if TTS fails
      await prisma.voiceProfile.delete({ where: { id: profile.id } }).catch(() => {})
      logger.error('[API] train: failed to create .pt voice profile', { ttsFileId, err })
      throw err
    }
  }

  logger.info('[API] train: voice profile created', { profileId: profile.id, ttsFileId, assetId: asset.id })

  // ── Step C: Generate voice sample synchronously ─────────────────────────
  let sampleUrl: string | null = null
  try {
    const result = await generateVoiceSample(profile.id, ttsProfileName, user.familyspaceId, user.id)
    sampleUrl = result.url
    logger.info('[API] train: sample generated', { profileId: profile.id })
  } catch (err) {
    // Sample generation is critical but non-blocking — the profile was
    // created successfully. Log and continue so the user doesn't lose
    // their voice profile on a transient TTS issue.
    logger.warn('[API] train: sample generation failed (non-fatal)', { profileId: profile.id, err })
  }

  return successResponse(res, {
    jobId: ttsFileId,
    modelId: profile.id,
    dbProfileId: profile.id,
    ttsProfileId: ttsFileId,
    status: 'completed',
    sampleAudioUrl: sampleUrl,
    sampleGenerated: sampleUrl !== null,
  })
}

export default apiHandler({
  POST: withMFAProtection(SENSITIVE_OPERATIONS.VOICE_TRAINING, trainVoiceHandler)
})
