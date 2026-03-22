import type { NextApiRequest, NextApiResponse } from 'next'
import { ttsRequest } from '@/lib/tts-client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { modelId, text, language = 'en' } = req.body

    if (!modelId || !text) {
      return res.status(400).json({ success: false, error: 'modelId and text are required' })
    }

    // Map language codes to Qwen3-TTS language names
    const langMap: Record<string, string> = {
      en: 'English',
      zh: 'Chinese',
      ja: 'Japanese',
      ko: 'Korean',
      auto: 'Auto',
    }
    const ttsLanguage = langMap[language] || 'English'

    const data = await ttsRequest('/api/tts/synthesize', {
      method: 'POST',
      body: {
        profileId: modelId,
        text,
        language: ttsLanguage,
      },
    })

    // Return the audio URL pointing back through the Next.js proxy
    return res.status(200).json({
      success: true,
      audioUrl: `/api/voice/audio/${data.audioId}`,
      modelId,
      text,
      language,
      duration: data.duration,
      synthesisTime: data.synthesisTime,
    })
  } catch (error: any) {
    console.error('[API] Synthesize error:', error.message)
    return res.status(503).json({
      success: false,
      error: error.message,
    })
  }
}
