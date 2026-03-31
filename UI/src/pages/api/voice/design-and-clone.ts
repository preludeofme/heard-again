import type { NextApiRequest, NextApiResponse } from 'next'
import { ttsRequest } from '@/lib/tts-client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { refText, instruct, profileName, language = 'English' } = req.body

    if (!refText || !instruct || !profileName) {
      return res.status(400).json({
        success: false,
        error: 'refText, instruct, and profileName are required',
      })
    }

    const data = await ttsRequest('/api/tts/design-and-clone', {
      method: 'POST',
      body: { refText, instruct, profileName, language },
    })

    return res.status(200).json({
      success: true,
      profileId: data.profileId,
      profilePath: data.profilePath,
      designAudioUrl: `/api/voice/audio/${data.designAudioUrl?.split('/').pop()}`,
      processingTime: data.processingTime,
      instruct: data.instruct,
    })
  } catch (error: any) {
    console.error('[API] Design-and-clone error:', error.message)
    return res.status(503).json({
      success: false,
      error: error.message,
    })
  }
}
