import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { TTS_SERVICE_URL } from '@/lib/tts-client'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { validateFileContent } from '@/lib/security/file-validator'
import { scanAndQuarantineFile } from '@/lib/security/malware-scanner'
import fs from 'fs/promises'
import path from 'path'
import formidable from 'formidable'
import { v4 as uuidv4 } from 'uuid'
const TTS_SERVICE_TOKEN = process.env.TTS_SERVICE_TOKEN
if (!TTS_SERVICE_TOKEN) {
  throw new Error('TTS_SERVICE_TOKEN environment variable is required for the voice upload pipeline')
}

/**
 * POST /api/voice/upload-sample
 * 
 * Full voice data pipeline:
 * 1. Parse multipart form
 * 2. Validate and scan the audio file
 * 3. Forward to TTS service for transcription and storage
 * 4. Create Asset record in database
 */
export const config = {
  api: {
    bodyParser: false,
  },
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let tempDir: string | undefined = undefined
  let audioFile: formidable.File | undefined = undefined

  try {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    // Create secure temporary upload directory
    tempDir = path.join(process.cwd(), 'temp-uploads', 'voice-samples', user.workspaceId)
    await fs.mkdir(tempDir, { recursive: true })

    const form = formidable({
      keepExtensions: false,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      uploadDir: tempDir,
      filename: () => `${uuidv4()}.tmp`,
    })

    const [fields, files] = await form.parse(req)
    const fileArray = files.audio
    
    if (!fileArray || fileArray.length === 0) {
      return res.status(400).json({ success: false, error: 'No audio file provided' })
    }

    audioFile = fileArray[0] as formidable.File
    const fileBuffer = await fs.readFile(audioFile.filepath)

    // 1. Validate file content (magic bytes)
    const validationResult = await validateFileContent(
      fileBuffer,
      audioFile.originalFilename || 'audio.wav',
      audioFile.mimetype || 'audio/wav'
    )
    
    if (!validationResult.isValid) {
      logger.error('[API] Voice sample validation failed:', validationResult.error)
      return res.status(400).json({ 
        success: false, 
        error: validationResult.error || 'Invalid file' 
      })
    }

    // 2. Scan for malware
    const { scanResult, quarantined } = await scanAndQuarantineFile(audioFile.filepath)
    
    if (!scanResult.isClean) {
      logger.error('[API] Malware detected in voice sample:', scanResult.threats)
      return res.status(403).json({
        success: false,
        error: `Security threat detected: ${scanResult.threats.join(', ')}`
      })
    }
    
    if (quarantined) {
      return res.status(403).json({
        success: false,
        error: 'File was quarantined during security scan'
      })
    }

    // 3. Forward to TTS service
    const formData = new FormData()
    const blob = new Blob([fileBuffer], { type: audioFile.mimetype || 'audio/wav' })
    formData.append('audio', blob, audioFile.originalFilename || 'audio.wav')

    const response = await fetch(`${TTS_SERVICE_URL}/api/tts/upload-reference`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${TTS_SERVICE_TOKEN}`,
        'X-Workspace-Id': user.workspaceId
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('[API] TTS service upload failed:', { status: response.status, error: errorText })
      return res.status(response.status).json({ success: false, error: errorText })
    }

    const ttsData = await response.json()

    // Create Asset record in database with transcript
    const asset = await prisma.asset.create({
      data: {
        workspaceId: user.workspaceId,
        filename: `${ttsData.fileId}.wav`,
        originalName: ttsData.fileName || audioFile.originalFilename || 'audio.wav',
        mimeType: 'audio/wav',
        sizeBytes: BigInt(fileBuffer.length),
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
  } finally {
    // Clean up temporary files
    if (audioFile) {
      try {
        await fs.unlink(audioFile.filepath)
      } catch (err) {
        // Ignore if already deleted/quarantined
      }
    }
    if (tempDir) {
      try {
        // Only remove if empty to be safe, or just leave it
        // Assets upload removes it recursively if it was a dedicated dir
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch (err) {
        logger.warn('[API] Failed to clean up temp directory:', err)
      }
    }
  }
}

export default handler
