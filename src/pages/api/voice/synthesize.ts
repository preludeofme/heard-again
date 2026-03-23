import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs/promises'
import path from 'path'
import { ttsRequest, TTS_SERVICE_URL } from '@/lib/tts-client'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let jobId: string | null = null

  try {
    const user = await getAuthUserWithWorkspace(req, res)
    const { modelId, text, language = 'en' } = req.body

    if (!modelId || !text) {
      return res.status(400).json({ success: false, error: 'modelId and text are required' })
    }

    const voiceProfile = await prisma.voiceProfile.findFirst({
      where: {
        id: modelId,
        workspaceId: user.workspaceId,
        status: 'READY',
      },
      select: {
        id: true,
        personId: true,
      },
    })

    if (!voiceProfile) {
      return res.status(404).json({
        success: false,
        error: 'Voice profile not found or not ready',
      })
    }

    if (voiceProfile.personId) {
      const activeConsent = await prisma.voiceConsent.findFirst({
        where: {
          workspaceId: user.workspaceId,
          revokedAt: null,
          allowsGeneration: true,
          OR: [
            { voiceProfileId: voiceProfile.id },
            { personId: voiceProfile.personId },
          ],
        },
        orderBy: { recordedAt: 'desc' },
      })

      if (!activeConsent) {
        return res.status(403).json({
          success: false,
          error: 'Voice generation is blocked until explicit consent is recorded',
          code: 'VOICE_CONSENT_REQUIRED',
        })
      }
    }

    const queuedJob = await prisma.voiceGenerationJob.create({
      data: {
        voiceProfileId: voiceProfile.id,
        text: String(text).substring(0, 10000),
        status: 'QUEUED',
        styleOverride: {
          requestedLanguage: language,
        },
      },
      select: { id: true },
    })
    jobId = queuedJob.id

    // Map language codes to Qwen3-TTS language names
    const langMap: Record<string, string> = {
      en: 'English',
      zh: 'Chinese',
      ja: 'Japanese',
      ko: 'Korean',
      auto: 'Auto',
    }
    const ttsLanguage = langMap[language] || 'English'

    await prisma.voiceGenerationJob.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
        styleOverride: {
          requestedLanguage: language,
          resolvedLanguage: ttsLanguage,
        },
      },
    })

    const data = await ttsRequest('/api/tts/synthesize', {
      method: 'POST',
      body: {
        profileId: modelId,
        text,
        language: ttsLanguage,
      },
    })

    const audioResponse = await fetch(`${TTS_SERVICE_URL}/api/tts/audio/${data.audioId}`)
    if (!audioResponse.ok) {
      throw new Error('Synthesized audio retrieval failed')
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())
    const outputDir = path.join(process.cwd(), 'generated', user.workspaceId, 'voice')
    await fs.mkdir(outputDir, { recursive: true })

    const fileName = `${data.audioId}.wav`
    const absoluteFilePath = path.join(outputDir, fileName)
    await fs.writeFile(absoluteFilePath, audioBuffer)

    const relativePath = path.relative(process.cwd(), absoluteFilePath)

    const outputAsset = await prisma.asset.create({
      data: {
        workspaceId: user.workspaceId,
        filename: fileName,
        originalName: fileName,
        mimeType: 'audio/wav',
        sizeBytes: BigInt(audioBuffer.byteLength),
        storageType: 'LOCAL',
        storagePath: relativePath,
        assetType: 'GENERATED_AUDIO',
        processingStatus: 'COMPLETED',
        uploadedById: user.id,
        durationSeconds: typeof data.duration === 'number' ? data.duration : null,
        metadata: {
          source: 'api.voice.synthesize',
          ttsAudioId: data.audioId,
          voiceProfileId: voiceProfile.id,
          personId: voiceProfile.personId,
        },
      },
    })

    await prisma.voiceGenerationJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        outputAssetId: outputAsset.id,
        computeTimeSeconds: typeof data.synthesisTime === 'number' ? data.synthesisTime : null,
        durationSeconds: typeof data.duration === 'number' ? data.duration : null,
        styleOverride: {
          requestedLanguage: language,
          resolvedLanguage: ttsLanguage,
          audioId: data.audioId,
          audioUrl: `/api/voice/audio/${data.audioId}`,
          personId: voiceProfile.personId,
        },
      },
    })

    // Return the audio URL pointing back through the Next.js proxy
    return res.status(200).json({
      success: true,
      jobId,
      audioUrl: `/api/voice/audio/${data.audioId}`,
      outputAssetId: outputAsset.id,
      outputAssetDownloadUrl: `/api/assets/${outputAsset.id}/download`,
      modelId,
      voiceProfileId: voiceProfile.id,
      personId: voiceProfile.personId,
      text,
      language,
      duration: data.duration,
      synthesisTime: data.synthesisTime,
      aiGenerated: true,
      disclosureLabel: 'AI-Generated Audio',
      watermark: {
        type: 'metadata',
        value: 'heard-again-ai-generated-v1',
      },
    })
  } catch (error: any) {
    if (jobId) {
      try {
        await prisma.voiceGenerationJob.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage: error.message,
          },
        })
      } catch {
        // Ignore secondary update failures in error path
      }
    }

    console.error('[API] Synthesize error:', error.message)
    return res.status(503).json({
      success: false,
      jobId,
      error: error.message,
    })
  }
}
