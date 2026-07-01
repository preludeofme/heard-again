import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { ttsRequest } from '@/lib/tts-client'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { generateVoiceSample } from '@/lib/voice/generate-voice-sample'
import { apiHandler, Errors } from '@/lib/api-helpers'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthUserWithFamilyspace(req, res)
  // Require EDITOR+ role — this also enforces MFA for OWNERs
  await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')
  const { refText, instruct, profileName, language = 'English' } = req.body

  if (!refText || !instruct || !profileName) {
    throw Errors.badRequest('refText, instruct, and profileName are required')
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
  let sampleAssetUrl: string | undefined

  try {
    const result = await generateVoiceSample(
      profile.id,
      ttsProfileId,
      user.familyspaceId,
      user.id,
    )
    sampleAssetUrl = result.url

    logger.info('[API] design-and-clone: sample audio generated', {
      profileId: profile.id,
      assetId: result.assetId,
    })
  } catch (sampleErr) {
    // Non-fatal: sample generation failed but the voice profile was created.
    // The user can re-generate a sample later from the voice lab.
    logger.warn('[API] design-and-clone: sample generation failed (non-fatal)', {
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
  })
}

export default apiHandler({
  POST: handler,
})
