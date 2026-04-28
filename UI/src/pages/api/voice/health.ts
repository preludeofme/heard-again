import type { NextApiRequest, NextApiResponse } from 'next'
import { ttsRequest } from '@/lib/tts-client'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    const data = await ttsRequest('/api/tts/health', {
      familyspaceId: user.familyspaceId,
    })
    return res.status(200).json({ success: true, ...data })
  } catch (error: any) {
    return res.status(503).json({
      success: false,
      error: error.message,
      hint: 'Is the TTS service running? Start with: cd tts-service && ./start.sh',
    })
  }
}

export default handler
