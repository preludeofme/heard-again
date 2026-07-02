import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { generateVoiceSample } from '@/lib/voice/generate-voice-sample'

/**
 * POST /api/voice/regenerate-sample
 *
 * One-shot: regenerate the voice sample for an existing VoiceProfile.
 * Returns the exact error if it fails so we can diagnose.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const { profileId } = req.body
    if (!profileId || typeof profileId !== 'string') {
      return res.status(400).json({ success: false, error: 'profileId is required' })
    }

    const profile = await prisma.voiceProfile.findFirst({
      where: { id: profileId, familyspaceId: user.familyspaceId },
      select: { id: true, externalId: true, name: true },
    })

    if (!profile) {
      return res.status(404).json({ success: false, error: 'VoiceProfile not found' })
    }

    const ttsProfileName = profile.externalId ?? profile.name

    // Check TTS provider config
    const providerInfo = {
      type: process.env.TTS_PROVIDER ?? 'rest',
      hasRunpodEndpoint: !!process.env.RUNPOD_TTS_ENDPOINT_ID,
      hasTtsServiceUrl: !!process.env.TTS_SERVICE_URL,
      hasRunpodKey: !!process.env.RUNPOD_API_KEY,
    }

    try {
      const result = await generateVoiceSample(
        profile.id,
        ttsProfileName,
        user.familyspaceId,
        user.id,
      )

      logger.info('[API] regenerate-sample: success', { profileId: profile.id, assetId: result.assetId })

      return res.status(200).json({
        success: true,
        profileId: profile.id,
        assetId: result.assetId,
        url: result.url,
        storageType: result.storageType,
        providerInfo,
      })
    } catch (err: any) {
      const errorMessage = err?.message ?? String(err)
      const errorStack = err?.stack ?? ''
      const errorName = err?.name ?? 'Error'

      logger.error('[API] regenerate-sample: failed', {
        profileId: profile.id,
        ttsProfileName,
        error: errorMessage,
        providerInfo,
      })

      return res.status(500).json({
        success: false,
        error: errorMessage,
        errorName,
        errorStack: errorStack.split('\n').slice(0, 5).join('\n'),
        ttsProfileName,
        providerInfo,
      })
    }
  } catch (err: any) {
    logger.error('[API] regenerate-sample: auth/setup error', { error: String(err) })
    return res.status(500).json({ success: false, error: String(err) })
  }
}
