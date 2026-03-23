import type { NextApiRequest, NextApiResponse } from 'next'
import { TTS_SERVICE_URL } from '@/lib/tts-client'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

/**
 * POST /api/voice/upload-sample
 * 
 * Full voice data pipeline:
 * 1. Stream multipart form to TTS service
 * 2. TTS service transcribes with Whisper
 * 3. Create Asset record in database with transcript
 */
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    // Stream the multipart form data directly to the TTS service
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk))
    }
    const body = Buffer.concat(chunks)

    const contentType = req.headers['content-type'] || ''

    // Upload to TTS service (auto-transcribes with Whisper)
    const response = await fetch(`${TTS_SERVICE_URL}/api/tts/upload-reference`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    })

    if (!response.ok) {
      const errorText = await response.text()
      return res.status(response.status).json({ success: false, error: errorText })
    }

    const ttsData = await response.json()

    // Create Asset record in database with transcript
    const asset = await prisma.asset.create({
      data: {
        workspaceId: user.workspaceId,
        filename: `${ttsData.fileId}.wav`,
        originalName: ttsData.fileName || 'audio.wav',
        mimeType: 'audio/wav',
        sizeBytes: BigInt(0), // Size not returned from TTS, could stat the file
        storageType: 'LOCAL',
        storagePath: ttsData.filePath,
        assetType: 'AUDIO',
        durationSeconds: ttsData.duration,
        transcript: ttsData.transcript,
        processingStatus: 'COMPLETED',
        uploadedById: user.id,
      },
    })

    return res.status(200).json({
      success: true,
      data: {
        ...ttsData,
        assetId: asset.id,
      },
      pipeline: {
        uploaded: true,
        transcribed: !!ttsData.transcript,
        stored: true,
      },
    })
  } catch (error: any) {
    console.error('[API] Upload sample error:', error.message)
    return res.status(503).json({
      success: false,
      error: error.message,
      hint: 'Is the TTS service running?',
    })
  }
}
