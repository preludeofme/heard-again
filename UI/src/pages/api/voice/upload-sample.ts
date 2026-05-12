import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getTTSProvider } from '@/lib/tts'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { validateFileContent } from '@/lib/security/file-validator'
import { scanAndQuarantineFile } from '@/lib/security/malware-scanner'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import formidable from 'formidable'
import { v4 as uuidv4 } from 'uuid'

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
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    // Create secure temporary upload directory
    tempDir = path.join(os.tmpdir(), 'voice-samples', user.familyspaceId)
    await fs.mkdir(tempDir, { recursive: true })

    const form = formidable({
      keepExtensions: false,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      uploadDir: tempDir,
      filename: () => `${uuidv4()}.tmp`,
    })

    const [fields, files] = await form.parse(req)
    const fileArray = files.audio
    const personId = Array.isArray(fields.personId) ? fields.personId[0] : fields.personId
    
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

    // 2.5 Register with Audio Processing Service (Chat Service)
    let audioProcessingId: string | undefined = undefined
    const chatServiceUrl = process.env.CHAT_SERVICE_URL || 'http://localhost:4778'
    
    try {
      const registerResponse = await fetch(`${chatServiceUrl}/api/audio/uploads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Familyspace-Id': user.familyspaceId,
          'X-User-Id': user.id
        },
        body: JSON.stringify({
          familyspaceId: user.familyspaceId,
          userId: user.id,
          personId: personId || undefined,
          fileName: audioFile.originalFilename || 'audio.wav',
          mimeType: audioFile.mimetype || 'audio/wav',
          processingPreference: 'enhanced' // Default to enhanced for voice cloning
        }),
      })

      if (registerResponse.ok) {
        const registerData = await registerResponse.json()
        audioProcessingId = registerData.data?.uploadId
        logger.info({ audioProcessingId }, 'Registered voice sample for audio processing')
      } else {
        logger.warn('[API] Failed to register voice sample for audio processing:', registerResponse.status)
      }
    } catch (err) {
      logger.error('[API] Audio processing registration error:', err)
      // Non-blocking
    }

    // 3. Forward to TTS service via provider
    const provider = getTTSProvider()
    const ttsData = await provider.uploadReference(
      fileBuffer,
      audioFile.originalFilename ?? 'audio.wav',
      audioFile.mimetype ?? 'audio/wav',
      user.familyspaceId
    )

    // Create Asset record in database with transcript and audioProcessingId
    const asset = await prisma.asset.create({
      data: {
        familyspaceId: user.familyspaceId,
        filename: `${ttsData.fileId}.wav`,
        originalName: ttsData.fileName || audioFile.originalFilename || 'audio.wav',
        mimeType: 'audio/wav',
        sizeBytes: BigInt(fileBuffer.length),
        storageType: ttsData.storageType,
        storagePath: ttsData.filePath,
        assetType: 'AUDIO',
        isAISynthesized: true, // Hide from Document Memories
        durationSeconds: ttsData.duration,
        transcript: ttsData.transcript,
        processingStatus: 'COMPLETED',
        uploadedById: user.id,
        metadata: {
          ttsFileId: ttsData.fileId,
          audioProcessingId, // Link to the processing job
        },
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
