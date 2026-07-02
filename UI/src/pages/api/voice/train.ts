import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getTTSProvider } from '@/lib/tts'
import { generateVoiceSample } from '@/lib/voice/generate-voice-sample'

/**
 * POST /api/voice/train
 *
 * Create a voice clone from uploaded audio samples.
 *
 * Because RunPod profile creation and sample synthesis can take 30–90 seconds
 * (triggering ERR_NETWORK_CHANGED in the browser), this endpoint now runs the
 * heavy lifting in a background Promise. It:
 *   1. Validates the request and creates the Prisma VoiceProfile record.
 *   2. Returns `{ status: 'processing', profileId }` immediately.
 *   3. Runs the RunPod profile creation + sample generation in the background.
 *   4. Updates the VoiceProfile status and sampleAudioUrl when done.
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

  logger.info('[API] train: voice profile record created, backgrounding work', {
    profileId: profile.id,
    ttsFileId,
  })

  // ── Return immediately while work runs in background ────────────────────
  res.status(200).json({
    success: true,
    status: 'training',
    profileId: profile.id,
    ttsProfileId: ttsFileId,
  })

  // ── Step B: Create .pt profile on TTS service (background) ──────────────
  ;(async () => {
    const ttsProvider = getTTSProvider()
    let ttsProfileName = ttsFileId

    if (ttsProvider.createVoiceProfile) {
      try {
        const result = await ttsProvider.createVoiceProfile(
          ttsFileId,
          profileName,
          styleInstruct
        )
        ttsProfileName = result.profileId
        logger.info('[API] train: .pt voice profile created', { profileId: result.profileId, ttsFileId })
      } catch (err) {
        logger.error('[API] train: failed to create .pt voice profile', { ttsFileId, err })
        await prisma.voiceProfile.update({
          where: { id: profile.id },
          data: { status: 'ERROR' },
        }).catch(() => {})
        return
      }
    }

    // ── Step C: Generate voice sample (background) ────────────────────────
    try {
      const result = await generateVoiceSample(profile.id, ttsProfileName, user.familyspaceId, user.id)

      await prisma.voiceProfile.update({
        where: { id: profile.id },
        data: {
          status: 'READY',
          sampleAudioUrl: result.url,
        },
      })

      logger.info('[API] train: sample generated and profile READY', { profileId: profile.id })
    } catch (err) {
      logger.warn('[API] train: sample generation failed', { profileId: profile.id, err })

      // Profile was created on TTS side, but sample failed — still mark READY
      // so the user can use it (just no sample to play yet).
      await prisma.voiceProfile.update({
        where: { id: profile.id },
        data: { status: 'READY' },
      }).catch(() => {})
    }
  })()
}

export default apiHandler({
  POST: trainVoiceHandler,
})
