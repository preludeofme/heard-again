import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { getStorageService } from '@/lib/storage/storage-service'

const TTS_SERVICE_URL = process.env.TTS_SERVICE_URL || 'http://127.0.0.1:4779'
const TTS_SERVICE_TOKEN = process.env.TTS_SERVICE_TOKEN || ''

export default apiHandler({
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    const storyId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const story = await prisma.story.findFirst({
      where: { id: storyId, familyspaceId: user.familyspaceId },
      select: {
        id: true,
        storyType: true,
        transcriptionStatus: true,
        generatedAudioAssetId: true,
        assets: {
          where: { assetRole: 'PRIMARY' },
          include: { asset: { select: { id: true, storagePath: true, mimeType: true, originalName: true, assetType: true } } },
          take: 1,
        },
      },
    })
    if (!story) throw Errors.notFound('Story')

    // Find the original audio asset: prefer a PRIMARY StoryAsset, fall back to generatedAudioAssetId for RECORDING stories
    let audioAsset: { id: string; storagePath: string; mimeType: string; originalName: string } | null = null

    if (story.assets.length > 0) {
      const candidate = story.assets[0].asset
      if (candidate.assetType === 'AUDIO' || candidate.mimeType.startsWith('audio/')) {
        audioAsset = candidate
      }
    }

    if (!audioAsset && story.storyType === 'RECORDING' && story.generatedAudioAssetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: story.generatedAudioAssetId },
        select: { id: true, storagePath: true, mimeType: true, originalName: true },
      })
      if (asset) audioAsset = asset
    }

    if (!audioAsset) {
      throw Errors.badRequest('No audio asset found on this story. Upload an audio recording first.')
    }

    await prisma.story.update({
      where: { id: storyId },
      data: { transcriptionStatus: 'PENDING' },
    })

    try {
      logger.info('[transcribe] fetching audio from storage', { storyId, assetId: audioAsset.id })
      const storage = getStorageService()
      const audioBuffer = await storage.getFile(audioAsset.storagePath)

      const ext = audioAsset.originalName.split('.').pop() || 'mp3'
      const mimeType = audioAsset.mimeType || 'audio/mpeg'
      const fileName = `${audioAsset.id}.${ext}`

      const formData = new FormData()
      formData.append('audio', new Blob([new Uint8Array(audioBuffer)], { type: mimeType }), fileName)

      logger.info('[transcribe] forwarding to TTS Whisper', { storyId, url: `${TTS_SERVICE_URL}/api/tts/transcribe` })

      const ttsRes = await fetch(`${TTS_SERVICE_URL}/api/tts/transcribe`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TTS_SERVICE_TOKEN}`,
          'X-Familyspace-Id': user.familyspaceId,
        },
        body: formData,
      })

      if (!ttsRes.ok) {
        const errText = await ttsRes.text().catch(() => 'unknown')
        logger.error('[transcribe] TTS transcription failed', { storyId, status: ttsRes.status, errText })
        await prisma.story.update({
          where: { id: storyId },
          data: { transcriptionStatus: 'FAILED' },
        })
        throw Errors.badRequest('Transcription service failed — check TTS logs')
      }

      const ttsData = await ttsRes.json()
      const transcript: string = ttsData.transcript || ''

      if (!transcript.trim()) {
        await prisma.story.update({
          where: { id: storyId },
          data: { transcriptionStatus: 'FAILED' },
        })
        throw Errors.badRequest('Transcription returned empty text')
      }

      const updated = await prisma.story.update({
        where: { id: storyId },
        data: {
          transcript,
          transcriptionStatus: 'COMPLETED',
          // Populate content so other features (search, excerpt) work on text stories too
          content: transcript,
        },
        select: {
          id: true,
          transcript: true,
          transcriptionStatus: true,
        },
      })

      logger.info('[transcribe] complete', { storyId, chars: transcript.length })
      return successResponse(res, updated)
    } catch (error) {
      if ((error as any)?.statusCode) throw error
      logger.error('[transcribe] unexpected error', {
        storyId,
        error: error instanceof Error ? error.message : String(error),
      })
      await prisma.story.update({
        where: { id: storyId },
        data: { transcriptionStatus: 'FAILED' },
      }).catch(() => {})
      return res.status(500).json({ success: false, error: 'Transcription failed unexpectedly' })
    }
  },
})
