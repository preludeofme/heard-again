import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { getStorageService } from '@/lib/storage/storage-service'
import { S3StorageProvider } from '@/lib/storage/providers/s3-provider'
import { getTTSProvider } from '@/lib/tts'
import { transcribeWithOpenAI } from '@/lib/tts/openai-transcribe'

const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const { assetId } = req.body as { assetId?: string }

    if (!assetId) {
      res.status(400).json({ error: 'assetId is required' })
      return
    }

    const asset = await prisma.asset.findFirst({
      where: { id: assetId, familyspaceId: user.familyspaceId },
    })

    if (!asset) {
      res.status(404).json({ error: 'Asset not found' })
      return
    }

    // Idempotent: if already processing, return the existing jobId so the client can poll
    if (asset.processingStatus === 'PROCESSING') {
      const meta = typeof asset.metadata === 'object' && asset.metadata !== null
        ? (asset.metadata as Record<string, unknown>)
        : {}
      res.status(200).json({ runpodJobId: meta.runpodJobId ?? '' })
      return
    }

    if (asset.processingStatus !== 'PENDING') {
      res.status(409).json({ error: `Asset is already in ${asset.processingStatus} state` })
      return
    }

    const storage = getStorageService()
    const rawProvider = storage.getProvider()
    const ttsProvider = getTTSProvider()

    // Local storage mode: call the REST TTS provider synchronously instead of RunPod
    if (!(rawProvider instanceof S3StorageProvider)) {
      const fileBuffer = await storage.getFile(asset.storagePath)

      // Transcription now goes through OpenAI Whisper directly — decoupled from
      // the TTS provider's own storage/reference-upload job, run concurrently.
      const [result, transcript] = await Promise.all([
        ttsProvider.uploadReference(fileBuffer, asset.originalName, asset.mimeType, user.familyspaceId),
        transcribeWithOpenAI(fileBuffer, asset.originalName, asset.mimeType),
      ])

      await prisma.asset.update({
        where: { id: assetId },
        data: {
          processingStatus: 'COMPLETED',
          transcript: transcript || result.transcript,
          durationSeconds: result.duration,
          storagePath: result.filePath,
          metadata: { ttsFileId: result.fileId },
        },
      })

      // Return a placeholder jobId — upload-status will see COMPLETED on first poll
      res.status(200).json({ runpodJobId: '' })
      return
    }

    // Get a short-lived presigned GET URL so RunPod can fetch the file from R2
    const { url: audioUrl } = await rawProvider.getSecureUrl(asset.storagePath, 900)

    if (!ttsProvider.submitUploadReferenceFromUrl) {
      res.status(400).json({ error: 'TTS provider does not support URL-based submission' })
      return
    }

    // Fetch the audio bytes once so we can transcribe via OpenAI in parallel
    // with the RunPod storage job, instead of relying on RunPod's own
    // (GPU-worker-bound) Whisper transcription.
    const fileBuffer = await storage.getFile(asset.storagePath)

    const [{ jobId: runpodJobId }, transcript] = await Promise.all([
      ttsProvider.submitUploadReferenceFromUrl(audioUrl, asset.originalName, asset.mimeType, user.familyspaceId),
      transcribeWithOpenAI(fileBuffer, asset.originalName, asset.mimeType),
    ])

    const existingMeta =
      typeof asset.metadata === 'object' && asset.metadata !== null
        ? (asset.metadata as Record<string, unknown>)
        : {}

    await prisma.asset.update({
      where: { id: assetId },
      data: {
        processingStatus: 'PROCESSING',
        metadata: { ...existingMeta, runpodJobId, openaiTranscript: transcript || null },
      },
    })

    res.status(200).json({ runpodJobId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process upload'
    logger.error('[API] process-upload error:', message)
    res.status(503).json({ error: message })
  }
}

export default handler
