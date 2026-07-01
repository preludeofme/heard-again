import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { getTTSProvider } from '@/lib/tts'
import { storageService } from '@/services/StorageService'

const SAMPLE_TEXT =
  'Hello, this is a sample of my digital voice. Thank you for preserving my story.'

export interface SampleResult {
  assetId: string
  url: string
  storageType: 'LOCAL' | 'S3' | 'CLOUDFLARE_R2' | 'AZURE_BLOB' | 'GOOGLE_CLOUD'
}

/**
 * Generate a true cloned voice sample for a given TTS voice profile.
 * Synthesises audio from the saved .pt profile (not the design reference clip),
 * stores it, creates an Asset record, and wires it to the VoiceProfile.
 *
 * Returns the asset ID and the API-serving URL for the sample.
 * Caller is responsible for catching failures — this is non-fatal to the
 * voice profile creation process.
 */
export async function generateVoiceSample(
  profileId: string,
  ttsProfileName: string,
  familyspaceId: string,
  userId: string
): Promise<SampleResult> {
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

  // Step 4: Determine actual storage type from environment
  const isCloudStorage =
    !!process.env.R2_ENDPOINT &&
    !!process.env.R2_ACCESS_KEY_ID &&
    !!process.env.R2_SECRET_ACCESS_KEY &&
    !!(process.env.R2_BUCKET_NAME || process.env.R2_BUCKET)

  const storageType: SampleResult['storageType'] = isCloudStorage ? 'CLOUDFLARE_R2' : 'LOCAL'

  // Step 5: Create Prisma Asset record
  const asset = await prisma.asset.create({
    data: {
      familyspaceId,
      filename: fileName,
      originalName: fileName,
      mimeType: 'audio/wav',
      sizeBytes: BigInt(audioBuffer.byteLength),
      storageType,
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

  // Step 6: Update VoiceProfile with sample URL pointing to the Asset API.
  // Use /api/assets/serve which handles both local and cloud storage.
  const sampleUrl = `/api/assets/serve/${asset.id}`
  await prisma.voiceProfile.update({
    where: { id: profileId },
    data: { sampleAudioUrl: sampleUrl },
  })

  logger.info('[voice] sample audio generated', { profileId, assetId: asset.id })
  return { assetId: asset.id, url: sampleUrl, storageType }
}
