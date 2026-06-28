import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { ttsRequest, TTS_SERVICE_URL } from '@/lib/tts-client'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getTTSProvider } from '@/lib/tts'
import { storageService } from '@/services/StorageService'

/**
 * Text used for auto-generated voice sample after cloning/designing a voice.
 * The sample demonstrates what the *cloned* voice sounds like reading a natural
 * sentence — not the VoiceDesign reference clip, but actual synthesised output
 * from the saved .pt profile.
 */
const SAMPLE_TEXT =
  "Hello, this is a sample of my digital voice. Thank you for preserving my story."

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    const { refText, instruct, profileName, language = 'English' } = req.body

    if (!refText || !instruct || !profileName) {
      return res.status(400).json({
        success: false,
        error: 'refText, instruct, and profileName are required',
      })
    }

    // ── Step 1: Design and clone via TTS service ──────────────────────────
    const data = await ttsRequest('/api/tts/design-and-clone', {
      method: 'POST',
      body: { refText, instruct, profileName, language },
      familyspaceId: user.familyspaceId,
    })

    // The TTS profile ID is the sanitised safe_name
    const ttsProfileId: string = data.profileId

    // ── Step 2: Create Prisma VoiceProfile record ─────────────────────────
    const profile = await prisma.voiceProfile.create({
      data: {
        familyspaceId: user.familyspaceId,
        createdById: user.id,
        name: profileName,
        description: instruct,
        isCloned: true,
        modelType: 'QWEN3_BASE',
        engineName: 'qwen3',
        engineVersion: language,
        styleParams: undefined,
        status: 'READY',
        externalId: ttsProfileId,
      },
      select: { id: true },
    })

    // ── Step 3: Generate a true cloned voice sample ───────────────────────
    // Use the saved .pt profile to synthesise a sample, so the preview
    // actually sounds like the cloned voice (not the design reference clip).
    let sampleAudioId: string | undefined
    let sampleAssetUrl: string | undefined

    try {
      const ttsProvider = getTTSProvider()
      const ttsData = await ttsProvider.synthesizeBatch(
        ttsProfileId,
        SAMPLE_TEXT,
        user.familyspaceId,
        null,
        async () => {},
      )

      const audioBuffer = await ttsProvider.downloadAudio(
        ttsData.audioId,
        user.familyspaceId,
      )

      const stored = await storageService.saveAudio(
        user.familyspaceId,
        ttsData.audioId,
        audioBuffer,
        { mimeType: 'audio/wav', extension: 'wav' },
      )

      const fileName =
        ttsData.audioId.split('/').pop() ?? `${ttsData.audioId}.wav`

      const asset = await prisma.asset.create({
        data: {
          familyspaceId: user.familyspaceId,
          filename: fileName,
          originalName: fileName,
          mimeType: 'audio/wav',
          sizeBytes: BigInt(audioBuffer.byteLength),
          storageType: 'LOCAL',
          storagePath: stored.path,
          assetType: 'GENERATED_AUDIO',
          isAISynthesized: true,
          processingStatus: 'COMPLETED',
          uploadedById: user.id,
          durationSeconds: ttsData.duration ?? null,
          metadata: {
            source: 'voice.profile.sample',
            ttsAudioId: ttsData.audioId,
            voiceProfileId: profile.id,
          },
        },
        select: { id: true },
      })

      sampleAudioId = asset.id
      sampleAssetUrl = `/api/assets/${asset.id}/download`

      // Update profile with sample URL
      await prisma.voiceProfile.update({
        where: { id: profile.id },
        data: { sampleAudioUrl: sampleAssetUrl },
      })

      logger.info(
        '[API] design-and-clone: sample audio generated',
        { profileId: profile.id, assetId: asset.id },
      )
    } catch (sampleErr) {
      // Non-fatal: sample generation failed but the voice profile was created.
      // The user can re-generate a sample later from the voice lab.
      logger.warn(
        '[API] design-and-clone: sample generation failed (non-fatal)',
        { profileId: profile.id, error: String(sampleErr) },
      )
    }

    return res.status(200).json({
      success: true,
      profileId: profile.id,
      ttsProfileId,
      sampleAudioUrl: sampleAssetUrl ?? null,
      sampleGenerated: !!sampleAssetUrl,
      processingTime: data.processingTime,
      instruct: data.instruct,
    })
  } catch (error: any) {
    logger.error('[API] Design-and-clone error:', error.message)
    return res.status(503).json({
      success: false,
      error: error.message,
    })
  }
}

export default handler
