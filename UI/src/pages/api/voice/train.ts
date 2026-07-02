import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getTTSProvider } from '@/lib/tts'
import { generateVoiceSample } from '@/lib/voice/generate-voice-sample'

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
  POST: trainVoiceHandler,
})
