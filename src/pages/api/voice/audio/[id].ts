import type { NextApiRequest, NextApiResponse } from 'next'
import { TTS_SERVICE_URL } from '@/lib/tts-client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query

  try {
    const response = await fetch(`${TTS_SERVICE_URL}/api/tts/audio/${id}`)

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Audio not found' })
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    res.setHeader('Content-Type', 'audio/wav')
    res.setHeader('Content-Length', buffer.length)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.send(buffer)
  } catch (error: any) {
    console.error('[API] Audio proxy error:', error.message)
    return res.status(503).json({ error: 'TTS service unavailable' })
  }
}
