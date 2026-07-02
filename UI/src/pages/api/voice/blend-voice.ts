import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { ttsRequest } from '@/lib/tts-client'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { generateVoiceSample } from '@/lib/voice/generate-voice-sample'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    const { fileId, refText, instruct, styleRefText, profileName, language = 'English' } = req.body

    if (!fileId || !instruct || !profileName) {
      return res.status(400).json({
        success: false,
        error: 'fileId, instruct, and profileName are required',
      })
    }

    // ── Step 1: Blend voice via TTS service ──────────────────────────────
    const data = await ttsRequest('/api/tts/blend-voice', {
      method: 'POST',
      body: { fileId, refText, instruct, styleRefText, profileName, language },
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

    // ── Step 3: Generate a true cloned voice sample ──────────────────────
    // Synthesise audio from the saved .pt profile so the preview actually
    // sounds like the blended voice. Stores to R2 and wires sampleAudioUrl.
    let sampleAssetUrl: string | undefined

    try {
      const result = await generateVoiceSample(
        profile.id,
        ttsProfileId,
        user.familyspaceId,
        user.id,
      )
      sampleAssetUrl = result.url

      logger.info('[API] blend-voice: sample audio generated', {
        profileId: profile.id,
        assetId: result.assetId,
      })
    } catch (sampleErr) {
      // Non-fatal: sample generation failed but the voice profile was created.
      // The user can re-generate a sample later from the voice lab.
      logger.warn('[API] blend-voice: sample generation failed (non-fatal)', {
        profileId: profile.id,
        error: String(sampleErr),
      })
    }

    return res.status(200).json({
      success: true,
      profileId: profile.id,
      ttsProfileId,
      sampleAudioUrl: sampleAssetUrl ?? null,
      sampleGenerated: !!sampleAssetUrl,
      processingTime: data.processingTime,
      instruct: data.instruct,
      blendMode: data.blendMode,
      familyspaceId: data.familyspaceId || user.familyspaceId,
    })
  } catch (error: any) {
    logger.error('[API] Blend-voice error:', error.message)
    return res.status(503).json({
      success: false,
      error: error.message,
    })
  }
}

export default handler
