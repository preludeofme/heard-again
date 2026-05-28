import type { NextApiRequest, NextApiResponse } from 'next'
import { ttsRequest } from '@/lib/tts-client'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'

/**
 * POST /api/voice/warmup
 *
 * Proxies to the TTS service's warmup endpoint, which triggers a throwaway
 * synthesis to pay the CUDA kernel compile cost once. This is called by the
 * useTTSWarmup hook on pages that are entry points to TTS features.
 *
 * Idempotent — safe to call repeatedly.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    const data = await ttsRequest('/api/tts/warmup', {
      method: 'POST',
      familyspaceId: user.familyspaceId,
    })
    return res.status(200).json({ success: true, ...data })
  } catch (error: any) {
    return res.status(503).json({
      success: false,
      error: error.message,
      hint: 'Is the TTS service running? Start with: cd TTS/tts-service && ./start.sh',
    })
  }
}

export default handler
