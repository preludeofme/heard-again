import { apiHandler, successResponse, errorResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { fetchWithCSRFAndFormData } from '@/lib/api-client'
import formidable from 'formidable'
import fs from 'fs'
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

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const form = formidable({})
    const [fields, files] = await form.parse(req)
    const fileArray = files.file

    if (!fileArray || fileArray.length === 0) {
      return errorResponse(res, 'No file provided', 400)
    }

    const file = fileArray[0]
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
      console.error('TTS transcription failed:', error)
      return errorResponse(res, 'Transcription service failed', 500)
    }

    const data = await ttsRes.json()
    return successResponse(res, data)

  } catch (error: any) {
    console.error('Transcription API error:', error)
    return errorResponse(res, error.message || 'Transcription failed', 500)
  }
}

export default withCSRFProtection(transcribeHandler)
