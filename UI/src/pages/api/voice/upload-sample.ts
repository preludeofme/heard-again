import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { TTS_SERVICE_URL } from '@/lib/tts-client'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { validateFileContent } from '@/lib/security/file-validator'
import { scanAndQuarantineFile } from '@/lib/security/malware-scanner'
import fs from 'fs/promises'

const TTS_SERVICE_TOKEN = process.env.TTS_SERVICE_TOKEN
if (!TTS_SERVICE_TOKEN) {
  throw new Error('TTS_SERVICE_TOKEN environment variable is required for the voice upload pipeline')
}

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

    // Buffer the request for security scanning
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk))
    }
    const fileBuffer = Buffer.concat(chunks)

    const contentType = req.headers['content-type'] || ''

    // 1. Validate file content (magic bytes)
    const validationResult = await validateFileContent(
      fileBuffer,
      'audio-upload.wav',
      contentType
    )
    
    if (!validationResult.isValid) {
      return res.status(400).json({ 
        success: false, 
        error: validationResult.error || 'Invalid file' 
      })
    }

    // 2. Scan for malware
    const tempFile = `/tmp/scan-${Date.now()}.wav`
    await fs.writeFile(tempFile, fileBuffer)
    
    try {
      const { scanResult, quarantined } = await scanAndQuarantineFile(tempFile)
      
      if (!scanResult.isClean) {
        return res.status(403).json({
          success: false,
          error: `Security threat detected: ${scanResult.threats.join(', ')}`
        })
      }
      
      // If file was quarantined (shouldn't happen if clean), abort
      if (quarantined) {
        return res.status(403).json({
          success: false,
          error: 'File was quarantined during security scan'
        })
      }
    } finally {
      // Clean up temp file
      try { await fs.unlink(tempFile) } catch {}
    }

    // 3. Now safe to forward to TTS service
    const response = await fetch(`${TTS_SERVICE_URL}/api/tts/upload-reference`, {
      method: 'POST',
      headers: { 
        'Content-Type': contentType,
        'Authorization': `Bearer ${TTS_SERVICE_TOKEN}`
      },
      body: fileBuffer,
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
    logger.error('[API] Upload sample error:', error.message)
    return res.status(503).json({
      success: false,
      error: error.message,
      hint: 'Is the TTS service running?',
    })
  }
}
