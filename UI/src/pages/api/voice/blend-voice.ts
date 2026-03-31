import type { NextApiRequest, NextApiResponse } from 'next'
import { ttsRequest } from '@/lib/tts-client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { fileId, refText, instruct, styleRefText, profileName, language = 'English' } = req.body

    if (!fileId || !instruct || !profileName) {
      return res.status(400).json({
        success: false,
        error: 'fileId, instruct, and profileName are required',
      })
    }

    const data = await ttsRequest('/api/tts/blend-voice', {
      method: 'POST',
      body: { fileId, refText, instruct, styleRefText, profileName, language },
    })

    return res.status(200).json({
      success: true,
      profileId: data.profileId,
      profilePath: data.profilePath,
      designAudioUrl: `/api/voice/audio/${data.designAudioUrl?.split('/').pop()}`,
      processingTime: data.processingTime,
      instruct: data.instruct,
      blendMode: data.blendMode,
    })
  } catch (error: any) {
    console.error('[API] Blend-voice error:', error.message)
    return res.status(503).json({
      success: false,
      error: error.message,
    })
  }
}
