import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { ttsRequest } from '@/lib/tts-client'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { withMFAProtection, SENSITIVE_OPERATIONS } from '@/lib/security/mfa'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'

async function trainVoiceHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthUserWithFamilyspace(req, res)
  await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

  const { samples, language, modelName, styleInstruct, personId } = req.body

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

  // In Qwen3-TTS, "training" is really creating a voice profile from reference audio.
  // We use the first sample's assetId to create the voice profile.
  const primaryAssetId = samples[0]

  // Retrieve the asset to get the internal TTS fileId
  const asset = await prisma.asset.findUnique({
    where: { id: primaryAssetId },
    select: { id: true, filename: true, metadata: true }
  })

  if (!asset) {
    throw Errors.notFound('Audio sample asset not found')
  }

  // Get the TTS fileId from metadata or fallback to filename parsing
  const metadata = asset.metadata as any
  const ttsFileId = metadata?.ttsFileId || asset.filename.split('.')[0]

  const data = await ttsRequest('/api/tts/create-voice-profile', {
    method: 'POST',
    familyspaceId: user.familyspaceId,
    body: {
      fileId: ttsFileId,
      refText: null,
      profileName: modelName || `voice_${Date.now()}`,
      styleInstruct: styleInstruct || null,
    },
  })

  // Use the TTS service's profileId as our modelArtifactAssetId for lookup
  const ttsProfileId = data.profileId

  const profile = await prisma.voiceProfile.create({
    data: {
      familyspaceId: user.familyspaceId,
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
      externalId: ttsProfileId,
      sourceAssetId: asset.id, // Link the actual database asset ID
    },
  })

  return successResponse(res, {
    jobId: data.profileId,
    modelId: profile.id, // Return the database ID for client use
    ttsProfileId: data.profileId, // Also return TTS profile ID
    status: 'completed',
    profilePath: data.profilePath,
    processingTime: data.processingTime,
    styleInstruct: data.styleInstruct,
    styleParams: data.styleParams,
  })
}

// Export with CSRF and MFA protection for voice training (sensitive operation)
export default apiHandler({
  POST: withMFAProtection(SENSITIVE_OPERATIONS.VOICE_TRAINING, trainVoiceHandler)
})

