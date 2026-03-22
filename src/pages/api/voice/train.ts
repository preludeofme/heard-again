import type { NextApiRequest, NextApiResponse } from 'next'
import { ttsRequest } from '@/lib/tts-client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { samples, language, modelName } = req.body

    if (!samples || !Array.isArray(samples) || samples.length === 0) {
      return res.status(400).json({ success: false, error: 'No samples provided' })
    }

    // In Qwen3-TTS, "training" is really creating a voice profile from reference audio.
    // We use the first sample's fileId to create the voice profile.
    const primaryFileId = samples[0]

    const data = await ttsRequest('/api/tts/create-voice-profile', {
      method: 'POST',
      body: {
        fileId: primaryFileId,
        refText: null, // Will be auto-transcribed by the model
        profileName: modelName || `voice_${Date.now()}`,
      },
    })

    return res.status(200).json({
      success: true,
      jobId: data.profileId,
      modelId: data.profileId,
      status: 'completed',
      profilePath: data.profilePath,
      processingTime: data.processingTime,
    })
  } catch (error: any) {
    console.error('[API] Train/create-profile error:', error.message)
    return res.status(503).json({
      success: false,
      error: error.message,
    })
  }
}
