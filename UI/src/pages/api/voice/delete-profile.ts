import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { ttsRequest } from '@/lib/tts-client'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    const { profileId } = req.query

    if (!profileId || typeof profileId !== 'string') {
      return res.status(400).json({ success: false, error: 'profileId query parameter is required' })
    }

    const data = await ttsRequest(`/api/tts/voice-profiles/${profileId}`, {
      method: 'DELETE',
      familyspaceId: user.familyspaceId,
    })

    return res.status(200).json({ success: true, ...data })
  } catch (error: any) {
    logger.error('[API] Delete profile error:', error.message)
    return res.status(503).json({
      success: false,
      error: error.message,
    })
  }
}

export default handler
