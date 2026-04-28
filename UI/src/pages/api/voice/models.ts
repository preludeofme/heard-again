import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { ttsRequest } from '@/lib/tts-client'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    const data = await ttsRequest('/api/tts/voice-profiles', {
      familyspaceId: user.familyspaceId,
    })

    // Map TTS service profiles to the VoiceModel shape expected by the frontend
    const models = (data.profiles || []).map((profile: any) => ({
      id: profile.id,
      userId: user.id,
      name: profile.id,
      displayName: profile.name,
      status: 'ready',
      language: 'en',
      sampleCount: 1,
      createdAt: new Date(profile.createdAt * 1000).toISOString(),
      modelPath: profile.filePath,
    }))

    return res.status(200).json({ success: true, models })
  } catch (error: any) {
    logger.error('[API] List models error:', error.message)
    // Return empty models instead of error so UI still works
    return res.status(200).json({ success: true, models: [] })
  }
}

export default handler
