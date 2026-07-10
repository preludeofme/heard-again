import { apiHandler, successResponse, errorResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { fetchWithCSRFAndFormData } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import formidable from 'formidable'
import fs from 'fs'
import fsPromises from 'fs/promises'
import os from 'os'
import path from 'path'
import { withCSRFProtection } from '@/lib/security/csrf'
import type { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: {
    bodyParser: false,
  },
}

async function transcribeHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return errorResponse(res, 'Method not allowed', 405)
  }

  let file: formidable.File | undefined

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    // Restrict uploads to a dedicated, per-familyspace temp directory (not the
    // shared OS temp root) with an explicit size cap.
    const uploadDir = path.join(os.tmpdir(), 'transcribe-uploads', user.familyspaceId)
    await fsPromises.mkdir(uploadDir, { recursive: true })

    const form = formidable({
      maxFileSize: 100 * 1024 * 1024, // 100MB
      uploadDir,
      keepExtensions: false,
    })
    const [fields, files] = await form.parse(req)
    const fileArray = files.file

    if (!fileArray || fileArray.length === 0) {
      return errorResponse(res, 'No file provided', 400)
    }

    file = fileArray[0]
    const fileBuffer = fs.readFileSync(file.filepath)

    // Forward to TTS service
    const ttsServiceUrl = process.env.TTS_SERVICE_URL || 'http://127.0.0.1:4779'
    const formData = new FormData()
    formData.append('audio', new Blob([fileBuffer]), file.originalFilename || 'audio.webm')

    const ttsRes = await fetch(`${ttsServiceUrl}/api/tts/transcribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TTS_SERVICE_SECRET || ''}`,
      },
      body: formData,
    })

    if (!ttsRes.ok) {
      const error = await ttsRes.text()
      logger.error({ error }, 'TTS transcription failed')
      return errorResponse(res, 'Transcription service failed', 500)
    }

    const data = await ttsRes.json()
    return successResponse(res, data)

  } catch (error: any) {
    logger.error({ error }, 'Transcription API error')
    return errorResponse(res, error.message || 'Transcription failed', 500)
  } finally {
    if (file?.filepath) {
      await fsPromises.unlink(file.filepath).catch(() => {})
    }
  }
}

export default withCSRFProtection(transcribeHandler)
