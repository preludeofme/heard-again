import type { NextApiRequest, NextApiResponse } from 'next'
import { ttsRequest } from '@/lib/tts-client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { profileId } = req.query

    if (!profileId || typeof profileId !== 'string') {
      return res.status(400).json({ success: false, error: 'profileId query parameter is required' })
    }

    const data = await ttsRequest(`/api/tts/voice-profiles/${profileId}`, {
      method: 'DELETE',
    })

    return res.status(200).json({ success: true, ...data })
  } catch (error: any) {
    console.error('[API] Delete profile error:', error.message)
    return res.status(503).json({
      success: false,
      error: error.message,
    })
  }
}
