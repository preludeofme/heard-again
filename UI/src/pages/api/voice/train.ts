import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { ttsRequest } from '@/lib/tts-client'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { withMFAProtection, SENSITIVE_OPERATIONS } from '@/lib/security/mfa'
import { withCSRFProtection } from '@/lib/security/csrf'

async function trainVoiceHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const { samples, language, modelName, styleInstruct, personId } = req.body

    if (!samples || !Array.isArray(samples) || samples.length === 0) {
      return res.status(400).json({ success: false, error: 'No samples provided' })
    }

    if (personId) {
      const person = await prisma.person.findFirst({
        where: { id: personId, workspaceId: user.workspaceId },
        select: { id: true },
      })
      if (!person) {
        return res.status(404).json({ success: false, error: 'Person not found in workspace' })
      }
    }

    // In Qwen3-TTS, "training" is really creating a voice profile from reference audio.
    // We use the first sample's fileId to create the voice profile.
    const primaryFileId = samples[0]

    const data = await ttsRequest('/api/tts/create-voice-profile', {
      method: 'POST',
      workspaceId: user.workspaceId,
      body: {
        fileId: primaryFileId,
        refText: null,
        profileName: modelName || `voice_${Date.now()}`,
        styleInstruct: styleInstruct || null,
      },
    })

    // Use the TTS service's profileId as our modelArtifactAssetId for lookup
    const ttsProfileId = data.profileId

    const profile = await prisma.voiceProfile.create({
      data: {
        workspaceId: user.workspaceId,
        createdById: user.id,
        personId: personId || null,
        name: modelName || `voice_${Date.now()}`,
        description: styleInstruct || null,
        isCloned: true,
        modelType: 'QWEN3_BASE',
        engineName: 'qwen3',
        engineVersion: language || 'English',
        styleParams: data.styleParams || null,
        status: 'READY',
        externalId: ttsProfileId, // Store TTS profile ID here (no FK constraint)
      },
    })

    return res.status(200).json({
      success: true,
      jobId: data.profileId,
      modelId: profile.id, // Return the database ID for client use
      ttsProfileId: data.profileId, // Also return TTS profile ID
      status: 'completed',
      profilePath: data.profilePath,
      processingTime: data.processingTime,
      styleInstruct: data.styleInstruct,
      styleParams: data.styleParams,
    })
  } catch (error: any) {
    logger.error('[API] Train/create-profile error:', error.message)
    return res.status(503).json({
      success: false,
      error: error.message,
    })
  }
}

// Export with CSRF and MFA protection for voice training (sensitive operation)
export default withCSRFProtection(
  withMFAProtection(SENSITIVE_OPERATIONS.VOICE_TRAINING, trainVoiceHandler)
)
