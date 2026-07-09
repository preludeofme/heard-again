import { task, logger as triggerLogger } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'
import { getTTSProvider } from '@/lib/tts'
import { generateVoiceSample } from '@/lib/voice/generate-voice-sample'
import { logger } from '@/lib/logger'

export interface VoiceTrainingTaskPayload {
  profileId: string
  ttsFileId: string
  profileName: string
  styleInstruct?: string
  familyspaceId: string
  userId: string
}

export const voiceTrainingTask = task({
  id: 'voice-training',
  // RunPod queue-stall ceiling (RUNPOD_QUEUE_TIMEOUT_MS, default 120s) +
  // execution ceiling (RUNPOD_POLL_TIMEOUT_MS, default 600s) + headroom for
  // the surrounding DB/storage work. Previously this was 600s — identical to
  // RUNPOD_POLL_TIMEOUT_MS's default — leaving no room for the WebSocket ->
  // polling fallback to run before Trigger.dev force-killed the task.
  maxDuration: 780, // 13 minutes

  retry: {
    maxAttempts: 1, // Only try once for profile creation to prevent redundant billing/compute
  },
  onFailure: async ({ payload, error }: { payload: VoiceTrainingTaskPayload; error: unknown }) => {
    logger.error('[voiceTrainingTask] failed', {
      profileId: payload.profileId,
      error: error instanceof Error ? error.message : String(error),
    })
    await prisma.voiceProfile.update({
      where: { id: payload.profileId },
      data: { status: 'ERROR' },
    }).catch(() => {})
  },
  run: async (payload: VoiceTrainingTaskPayload): Promise<{ success: boolean }> => {
    const { profileId, ttsFileId, profileName, styleInstruct, familyspaceId, userId } = payload

    triggerLogger.info('Starting voice profile creation task', { profileId, ttsFileId })

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
        triggerLogger.info('.pt voice profile created on TTS service', { ttsProfileName, profileId })
      } catch (err: any) {
        triggerLogger.error('Failed to create .pt voice profile', { profileId, error: err.message })
        await prisma.voiceProfile.update({
          where: { id: profileId },
          data: { status: 'ERROR' },
        }).catch(() => {})
        throw err
      }
    }

    // ── Generate voice sample ────────────────────────
    try {
      triggerLogger.info('Generating voice sample', { profileId, ttsProfileName })
      const result = await generateVoiceSample(profileId, ttsProfileName, familyspaceId, userId)

      await prisma.voiceProfile.update({
        where: { id: profileId },
        data: {
          status: 'READY',
          sampleAudioUrl: result.url,
        },
      })

      triggerLogger.info('Voice sample generated and profile marked READY', { profileId })
    } catch (err: any) {
      triggerLogger.warn('Voice sample generation failed', { profileId, error: err.message })

      // Profile was created on TTS side, but sample failed — still mark READY
      // so the user can use it (just no sample to play yet).
      await prisma.voiceProfile.update({
        where: { id: profileId },
        data: { status: 'READY' },
      }).catch(() => {})
    }

    return { success: true }
  },
})
