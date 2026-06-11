/**
 * VoiceService - Business logic for voice synthesis and profile management
 * Finding 5.1: Create Service Layer - Extracted from /api/voice/synthesize.ts
 */

import { ttsRequest, TTS_SERVICE_URL } from '@/lib/tts-client'
import { AppError } from '@/lib/api-helpers'
import { voiceProfileRepository, VoiceProfileRepository } from '@/server/repositories/VoiceProfileRepository'
import { voiceConsentRepository, VoiceConsentRepository } from '@/server/repositories/VoiceConsentRepository'
import { assetRepository, AssetRepository } from '@/server/repositories/AssetRepository'
import { prisma } from '@/lib/prisma'
import { consentTokenService } from '@/server/services/voice/ConsentTokenService'
import { getTTSProvider } from '@/lib/tts'
import { incrementGenerationMinutes } from '@/lib/entitlements'

export interface SynthesizeRequest {
  familyspaceId: string
  userId: string
  modelId: string
  text: string
  language?: string
  authToken: string
}

export interface SynthesisResult {
  jobId: string
  audioUrl: string
  outputAssetId: string
  outputAssetDownloadUrl: string
  modelId: string
  voiceProfileId: string
  personId: string | null
  text: string
  language: string
  duration?: number
  synthesisTime?: number
  aiGenerated: true
  disclosureLabel: string
  watermark: {
    type: string
    value: string
  }
}

export interface VoiceProfileInfo {
  id: string
  personId: string | null
  externalId: string | null
}

const LANGUAGE_MAP: Record<string, string> = {
  en: 'English',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  auto: 'Auto',
}

export class VoiceService {
  private prisma = prisma

  constructor(
    private voiceProfileRepo: VoiceProfileRepository = voiceProfileRepository,
    private voiceConsentRepo: VoiceConsentRepository = voiceConsentRepository,
    private assetRepo: AssetRepository = assetRepository
  ) {}

  /**
   * Get voice profile with validation
   */
  async getVoiceProfile(
    familyspaceId: string,
    profileId: string
  ): Promise<{ id: string; personId: string | null; name: string; externalId: string | null }> {
    const profile = await this.voiceProfileRepo.findById(profileId, familyspaceId)

    if (!profile || profile.status !== 'READY') {
      throw new AppError(
        'Voice profile not found or not ready',
        404,
        'VOICE_PROFILE_NOT_FOUND'
      )
    }

    return {
      id: profile.id,
      personId: profile.personId,
      name: profile.name,
      externalId: profile.externalId,
    }
  }

  /**
   * Check voice consent for a person
   */
  async checkVoiceConsent(
    familyspaceId: string,
    voiceProfileId: string,
    personId: string
  ): Promise<boolean> {
    const activeConsent = await this.prisma.voiceConsent.findFirst({
      where: {
        familyspaceId,
        revokedAt: null,
        allowsGeneration: true,
        OR: [{ voiceProfileId }, { personId }],
      },
      orderBy: { recordedAt: 'desc' },
    })

    return activeConsent !== null
  }

  /**
   * Create a voice generation job
   */
  async createGenerationJob(
    voiceProfileId: string,
    text: string,
    language: string
  ): Promise<{ id: string }> {
    const job = await this.prisma.voiceGenerationJob.create({
      data: {
        voiceProfileId,
        text: String(text).substring(0, 10000),
        status: 'QUEUED',
        styleOverride: { requestedLanguage: language },
      },
      select: { id: true },
    })

    return job
  }

  /**
   * Update job status to processing
   */
  async markJobProcessing(
    jobId: string,
    language: string,
    resolvedLanguage: string
  ): Promise<void> {
    await this.prisma.voiceGenerationJob.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
        styleOverride: { requestedLanguage: language, resolvedLanguage },
      },
    })
  }

  /**
   * Update job status to failed
   */
  async markJobFailed(
    jobId: string,
    errorMessage: string
  ): Promise<void> {
    await this.prisma.voiceGenerationJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage,
      },
    })
  }

  /**
   * Complete job and create output asset
   */
  async completeJob(
    jobId: string,
    voiceProfileId: string,
    personId: string | null,
    audioId: string,
    audioBuffer: Buffer,
    duration: number | undefined,
    synthesisTime: number | undefined,
    familyspaceId: string,
    userId: string,
    language: string,
    resolvedLanguage: string
  ): Promise<{ assetId: string; fileName: string }> {
    // Extract just the filename from the R2 key (last segment after /)
    const r2FileName = audioId.split('/').pop() ?? audioId
    const fileName = `${r2FileName}`

    // The RunPod handler already uploaded the audio to R2 at audioId.
    // Record the R2 key directly as the storage path rather than re-uploading.
    const r2Key = audioId

    // Create asset record pointing to the existing R2 object
    const asset = await this.assetRepo.create({
      familyspaceId,
      filename: fileName,
      originalName: fileName,
      mimeType: 'audio/wav',
      sizeBytes: BigInt(audioBuffer.byteLength),
      storageType: 'S3',
      storagePath: r2Key,
      assetType: 'GENERATED_AUDIO',
      isAISynthesized: true, // Mark as AI synthesized
      processingStatus: 'COMPLETED',
      uploadedById: userId,
      durationSeconds: duration ?? null,
      metadata: {
        source: 'api.voice.synthesize',
        ttsAudioId: audioId,
        voiceProfileId,
        personId,
        aiGenerated: true,
        watermark: 'AI-generated by Heard Again',
      },
    }, userId)

    // Update job with completion info
    await this.prisma.voiceGenerationJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        outputAssetId: asset.id,
        computeTimeSeconds: synthesisTime ?? null,
        durationSeconds: duration ?? null,
        styleOverride: {
          requestedLanguage: language,
          resolvedLanguage,
          audioId,
          audioUrl: `/api/voice/audio/${audioId}`,
          personId,
        },
      },
    })

    return { assetId: asset.id, fileName }
  }

  /**
   * Main synthesis workflow
   */
  async synthesize(request: SynthesizeRequest): Promise<SynthesisResult> {
    const { familyspaceId, userId, modelId, text, language = 'en' } = request

    // Validate required fields
    if (!modelId || !text) {
      throw new AppError('modelId and text are required', 400, 'VALIDATION_ERROR')
    }

    // R6 - Content filter on TTS input (slurs, violence, etc.)
    const inappropriatePatterns = /\b(hate|kill|harm|violence|abuse|slur1|slur2)\b/gi // Simplified slur list
    if (inappropriatePatterns.test(text)) {
      throw new AppError(
        'The provided text contains inappropriate content that cannot be synthesized.',
        400,
        'CONTENT_FILTER_VIOLATION'
      )
    }

    // Get and validate voice profile
    const profile = await this.getVoiceProfile(familyspaceId, modelId)

    let consentId: string | null = null

    // Check consent if voice is linked to a person
    if (profile.personId) {
      const activeConsent = await this.prisma.voiceConsent.findFirst({
        where: {
          familyspaceId,
          revokedAt: null,
          allowsGeneration: true,
          OR: [{ voiceProfileId: profile.id }, { personId: profile.personId }],
        },
        orderBy: { recordedAt: 'desc' },
        select: { id: true },
      })

      if (!activeConsent) {
        throw new AppError(
          'Voice generation is blocked until explicit consent is recorded',
          403,
          'VOICE_CONSENT_REQUIRED'
        )
      }
      consentId = activeConsent.id
    }

    // Issue a signed consent token for the TTS service (R1)
    const consentToken = consentTokenService.issueToken({
      familyspaceId,
      profileId: profile.id,
      consentId: consentId || 'unlinked',
    })

    // Create job
    const job = await this.createGenerationJob(profile.id, text, language)
    const jobId = job.id

    try {
      // Resolve language
      const resolvedLanguage = LANGUAGE_MAP[language] || 'English'

      // Mark as processing
      await this.markJobProcessing(jobId, language, resolvedLanguage)

      // Call TTS service via the provider wrapper (supports RunPod Serverless)
      const ttsProvider = getTTSProvider()
      
      const ttsData = await ttsProvider.synthesizeBatch(
        profile.externalId || profile.name, // Use externalId if available (for RunPod compat)
        text,
        familyspaceId,
        null, // No reference text needed for clone playback
        async (progress) => {
          // Progress callbacks ignored for simple sample generation
        }
      )

      // Download the audio buffer
      const audioBuffer = await ttsProvider.downloadAudio(
        ttsData.audioId,
        familyspaceId
      )

      // Complete job and save asset
      const { assetId } = await this.completeJob(
        jobId,
        profile.id,
        profile.personId,
        ttsData.audioId,
        audioBuffer,
        ttsData.duration,
        ttsData.synthesisTime,
        familyspaceId,
        userId,
        language,
        resolvedLanguage
      )

      // Track usage: increment generation minutes for billing/quota
      if (ttsData.duration) {
        await incrementGenerationMinutes(familyspaceId, ttsData.duration).catch((err) => {
          console.warn('[VoiceService] Failed to increment generation minutes:', err)
          // Non-fatal — don't break the synthesis result
        })
      }

      return {
        jobId,
        audioUrl: `/api/voice/audio/${assetId}`,
        outputAssetId: assetId,
        outputAssetDownloadUrl: `/api/assets/${assetId}/download`,
        modelId,
        voiceProfileId: profile.id,
        personId: profile.personId,
        text,
        language,
        duration: ttsData.duration,
        synthesisTime: ttsData.synthesisTime,
        aiGenerated: true,
        disclosureLabel: 'AI-Generated Audio',
        watermark: {
          type: 'metadata',
          value: 'heard-again-ai-generated-v1',
        },
      }
    } catch (error) {
      // Mark job as failed
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.markJobFailed(jobId, errorMessage)
      throw error
    }
  }
}
