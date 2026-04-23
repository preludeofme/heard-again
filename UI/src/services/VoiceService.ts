/**
 * VoiceService - Business logic for voice synthesis and profile management
 * Finding 5.1: Create Service Layer - Extracted from /api/voice/synthesize.ts
 */

import type { PrismaClient } from '@prisma/client'
import { storageService } from './StorageService'
import { ttsRequest, TTS_SERVICE_URL } from '@/lib/tts-client'
import { AppError } from '@/lib/api-helpers'

export interface SynthesizeRequest {
  workspaceId: string
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
  constructor(private prisma: PrismaClient) {}

  /**
   * Get voice profile with validation
   */
  async getVoiceProfile(
    workspaceId: string,
    profileId: string
  ): Promise<{ id: string; personId: string | null; name: string }> {
    const profile = await this.prisma.voiceProfile.findFirst({
      where: {
        id: profileId,
        workspaceId,
        status: 'READY',
      },
      select: {
        id: true,
        personId: true,
        name: true,
      },
    })

    if (!profile) {
      throw new AppError(
        'Voice profile not found or not ready',
        404,
        'VOICE_PROFILE_NOT_FOUND'
      )
    }

    return profile
  }

  /**
   * Check voice consent for a person
   */
  async checkVoiceConsent(
    workspaceId: string,
    voiceProfileId: string,
    personId: string
  ): Promise<boolean> {
    const activeConsent = await this.prisma.voiceConsent.findFirst({
      where: {
        workspaceId,
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
    workspaceId: string,
    userId: string,
    language: string,
    resolvedLanguage: string
  ): Promise<{ assetId: string; fileName: string }> {
    const fileName = `${audioId}.wav`

    // Save audio file via StorageService
    const storedFile = await storageService.saveAudio(
      workspaceId,
      audioId,
      audioBuffer,
      { mimeType: 'audio/wav', extension: 'wav' }
    )

    // Create asset record
    const asset = await this.prisma.asset.create({
      data: {
        workspaceId,
        filename: fileName,
        originalName: fileName,
        mimeType: 'audio/wav',
        sizeBytes: BigInt(audioBuffer.byteLength),
        storageType: 'LOCAL',
        storagePath: storedFile.path,
        assetType: 'GENERATED_AUDIO',
        processingStatus: 'COMPLETED',
        uploadedById: userId,
        durationSeconds: duration ?? null,
        metadata: {
          source: 'api.voice.synthesize',
          ttsAudioId: audioId,
          voiceProfileId,
          personId,
        },
      },
    })

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
    const { workspaceId, userId, modelId, text, language = 'en' } = request

    // Validate required fields
    if (!modelId || !text) {
      throw new AppError('modelId and text are required', 400, 'VALIDATION_ERROR')
    }

    // Get and validate voice profile
    const profile = await this.getVoiceProfile(workspaceId, modelId)

    // Check consent if voice is linked to a person
    if (profile.personId) {
      const hasConsent = await this.checkVoiceConsent(
        workspaceId,
        profile.id,
        profile.personId
      )
      if (!hasConsent) {
        throw new AppError(
          'Voice generation is blocked until explicit consent is recorded',
          403,
          'VOICE_CONSENT_REQUIRED'
        )
      }
    }

    // Create job
    const job = await this.createGenerationJob(profile.id, text, language)
    const jobId = job.id

    try {
      // Resolve language
      const resolvedLanguage = LANGUAGE_MAP[language] || 'English'

      // Mark as processing
      await this.markJobProcessing(jobId, language, resolvedLanguage)

      // Call TTS service - use profile name as identifier
      const ttsData = await ttsRequest<{
        audioId: string
        duration?: number
        synthesisTime?: number
      }>('/api/tts/synthesize', {
        method: 'POST',
        authToken: request.authToken,
        workspaceId,
        body: {
          profileId: profile.name,
          text,
          language: resolvedLanguage,
          workspaceId,  // Explicit workspace for tenant isolation
        },
      })

      // Fetch audio with appropriate auth
      // Use provided token or fallback to service-to-service token
      const authHeader = request.authToken 
        ? `Bearer ${request.authToken}`
        : `Bearer ${process.env.TTS_SERVICE_TOKEN}`

      const audioResponse = await fetch(
        `${TTS_SERVICE_URL}/api/tts/audio/${ttsData.audioId}`,
        {
          headers: {
            'Authorization': authHeader,
            'X-Workspace-Id': workspaceId,
          },
        }
      )
      
      if (!audioResponse.ok) {
        const errorText = await audioResponse.text()
        throw new AppError(`Synthesized audio retrieval failed (${audioResponse.status}): ${errorText}`, 503, 'TTS_AUDIO_FETCH_FAILED')
      }

      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())

      // Complete job and save asset
      const { assetId } = await this.completeJob(
        jobId,
        profile.id,
        profile.personId,
        ttsData.audioId,
        audioBuffer,
        ttsData.duration,
        ttsData.synthesisTime,
        workspaceId,
        userId,
        language,
        resolvedLanguage
      )

      return {
        jobId,
        audioUrl: `/api/voice/audio/${ttsData.audioId}`,
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
