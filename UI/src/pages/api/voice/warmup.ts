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
      // For RunPod serverless, predictive warmup: fire a minimal 1-word job
      // to wake the GPU, then return immediately. Do NOT wait for the job to
      // complete — that would take 10-30s on a cold GPU and cause
      // ERR_NETWORK_CHANGED (browser timeout) or Vercel 10s HFC timeout.
      //
      // Strategy:
      // 1. User navigates to TTS-heavy page → /api/voice/warmup called
      // 2. We POST a tiny synthesis job (~$0.0002) to RunPod's /run endpoint
      // 3. Return 200 immediately; RunPod warms GPU in the background
      // 4. GPU stays warm for 5 min via idleTimeout from any real job
      // 5. If no activity for 5 min, GPU scales to zero → no idle cost
      
      const jobId = await runpodWarmupJob()
      
      // Mark cooldown
      if (!globalThis.__warmupCooldowns) {
        globalThis.__warmupCooldowns = new Map<string, number>()
      }
      globalThis.__warmupCooldowns.set(cooldownKey, Date.now())

      return res.status(200).json({
        success: true,
        message: 'RunPod warmup submitted — GPU will warm in background',
        warmed: true,
        provider: 'runpod_serverless',
        jobId,
        costEstimate: '$0.0002',
      })
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

/**
 * Submit a tiny 1-word synthesis job to RunPod's async /run endpoint.
 * Returns immediately after submission — does NOT wait for completion.
 * This is intentional: waiting would trigger ERR_NETWORK_CHANGED on cold GPUs.
 */
async function runpodWarmupJob(): Promise<string> {
  const apiKey = process.env.RUNPOD_API_KEY
  const endpointId = process.env.RUNPOD_TTS_ENDPOINT_ID

  if (!apiKey || !endpointId) {
    throw new Error('RUNPOD_API_KEY and RUNPOD_TTS_ENDPOINT_ID must be set')
  }

  const res = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: {
        action: 'synthesize_batch',
        profileName: 'warmup',
        text: 'Hi.',
        familyspaceId: 'system',
        language: 'English',
        silencePaddingMs: 100,
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`RunPod warmup submission failed (${res.status}): ${errText}`)
  }

  const data = await res.json()
  return data.id
}

export default handler
