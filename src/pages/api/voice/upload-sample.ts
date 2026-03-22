import type { NextApiRequest, NextApiResponse } from 'next'
import { TTS_SERVICE_URL } from '@/lib/tts-client'

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
    // Stream the multipart form data directly to the TTS service
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk))
    }
    const body = Buffer.concat(chunks)

    const contentType = req.headers['content-type'] || ''

    const response = await fetch(`${TTS_SERVICE_URL}/api/tts/upload-reference`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    })

    if (!response.ok) {
      const errorText = await response.text()
      return res.status(response.status).json({ success: false, error: errorText })
    }

    const data = await response.json()
    return res.status(200).json({ success: true, data })
  } catch (error: any) {
    console.error('[API] Upload sample error:', error.message)
    return res.status(503).json({
      success: false,
      error: error.message,
      hint: 'Is the TTS service running?',
    })
  }
}
