import { useEffect, useRef } from 'react'

const WARMUP_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes between warmup pings
const WARMUP_TIMEOUT_MS = 8_000 // Don't wait more than 8s for a warmup response

let lastWarmupTime = 0
let pendingWarmup: Promise<void> | null = null

/**
 * Fire-and-forget warmup ping to the TTS service.
 * Uses module-level debounce so repeated page navigations within the
 * cooldown window don't stack up cold starts or costs.
 */
function pingTTSWarmup(): void {
  const now = Date.now()
  if (now - lastWarmupTime < WARMUP_COOLDOWN_MS) return

  // Deduplicate in-flight warmups across concurrent hook instances
  if (pendingWarmup) return

  lastWarmupTime = now

  // Prefer the Next.js proxy route (handles auth via cookies) over a direct
  // TTS service URL. The proxy is at /api/voice/warmup and forwards to the
  // Python TTS service's /api/tts/warmup, which triggers a throwaway
  // synthesis to pay the CUDA kernel compile cost.
  const warmupUrl = '/api/voice/warmup'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WARMUP_TIMEOUT_MS)

  pendingWarmup = fetch(warmupUrl, {
    method: 'POST',
    signal: controller.signal,
  })
    .then(() => {
      // GPU is now warm — no action needed
    })
    .catch(() => {
      // Silently ignore — warmup is best-effort. The real request will retry.
    })
    .finally(() => {
      clearTimeout(timeout)
      pendingWarmup = null
    })
}

/**
 * Hook: pre-warms the TTS container when a component mounts.
 * Use on pages/components that are entry points to TTS features
 * (Voice Lab, story narration, voice signature on profile).
 *
 * Debounced to once per 5 minutes across the entire session —
 * rapid navigation won't trigger redundant warmup calls.
 */
export function useTTSWarmup(enabled = true): void {
  const firedRef = useRef(false)

  useEffect(() => {
    if (!enabled || firedRef.current) return
    firedRef.current = true

    // Small delay so the page renders first, then fire warmup
    const timer = setTimeout(() => pingTTSWarmup(), 300)
    return () => clearTimeout(timer)
  }, [enabled])
}
