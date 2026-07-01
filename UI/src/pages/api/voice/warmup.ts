import type { NextApiRequest, NextApiResponse } from 'next'
import { ttsRequest } from '@/lib/tts-client'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'

/**
 * POST /api/voice/warmup
 *
 * Triggers a throwaway TTS job to pre-warm the GPU and pay the CUDA kernel
 * compile cost. For RunPod serverless, this starts a cold GPU and keeps it
 * alive for ~5 minutes via idleTimeout. Called by useTTSWarmup on TTS-heavy
 * pages to ensure fast first-run experience.
 *
 * Idempotent — safe to call repeatedly (has server-side cooldown).
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Rate-limit warmup calls: only allow one warmup per familyspace per 5 min
  const cooldownKey = `warmup:${req.headers['x-familyspace-id'] || 'anon'}`
  const now = Date.now()
  const lastWarmup = globalThis.__warmupCooldowns?.get(cooldownKey) || 0
  if (now - lastWarmup < 5 * 60 * 1000) {
    return res.status(200).json({ success: true, message: 'Recently warmed', warmed: false, cooldownRemaining: Math.round((5 * 60 * 1000 - (now - lastWarmup)) / 1000) })
  }

  try {
    if (process.env.TTS_PROVIDER === 'runpod_serverless') {
      // For RunPod serverless, predictive warmup: trigger a minimal 1-word job
      // when user shows intent (navigates to voice features). This pays for first
      // cold start, keeps GPU alive for 5 min via idleTimeout.
      //
      // Strategy:
      // 1. User hits Voice Lab → call /api/voice/warmup (this)
      // 2. We fire a tiny synthesis job (~$0.0002) to wake GPU
      // 3. GPU stays warm for 5 min → all synthesis during that window is fast
      // 4. If no activity for 5 min, GPU scales to zero → no idle cost
      //
      // Cost math: 50 free users × 1 warmup each = 50 jobs × $0.0002 = $0.01/month
      // Plus actual synthesis: negligible for free tier (usage-gated)
      
      const { getTTSProvider } = await import('@/lib/tts')
      const provider = getTTSProvider()

      try {
        // Minimal job: 1-word, no reference audio needed for warmup
        await provider.synthesizeBatch(
          'warmup',  // fake profile name (won't match, but triggers model load)
          'Hi.',     // 1 word = fastest possible job
          'system',  // system familyspace (won't save result)
          null,
          async () => {}, // no-op progress
          async () => {}  // no-op job submitted
        )
        
        // Mark cooldown
        if (!globalThis.__warmupCooldowns) {
          globalThis.__warmupCooldowns = new Map<string, number>()
        }
        globalThis.__warmupCooldowns.set(cooldownKey, Date.now())

        return res.status(200).json({
          success: true,
          message: 'RunPod GPU warmed — ready for synthesis',
          warmed: true,
          provider: 'runpod_serverless',
          costEstimate: '$0.0002',
        })
      } catch (warmupErr) {
        // Warmup failures: GPU may be cold, but first real request will handle it
        console.warn('[Warmup] Non-fatal warmup failure (GPU will warm on first real request):', warmupErr)
        
        return res.status(200).json({
          success: true,
          message: 'RunPod serverless ready — first request will trigger GPU warmup',
          warmed: false,
          provider: 'runpod_serverless',
          hint: warmupErr instanceof Error ? warmupErr.message : 'Unknown error',
        })
      }
    }

    // Fallback: local REST TTS service
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
      hint: process.env.TTS_PROVIDER === 'runpod_serverless'
        ? 'RunPod endpoint may be misconfigured. Check RUNPOD_API_KEY and RUNPOD_TTS_ENDPOINT_ID.'
        : 'Is the TTS service running? Start with: cd TTS/tts-service && ./start.sh',
    })
  }
}

// TypeScript declaration for global cooldown cache
declare global {
  // eslint-disable-next-line no-var
  var __warmupCooldowns: Map<string, number> | undefined
}

export default handler
