import { useEffect, useRef } from 'react'

const WARMUP_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes between warmup pings

let lastWarmupTime = 0
let pendingWarmup: Promise<void> | null = null

/**
 * Fire-and-forget warmup ping to the TTS service.
 * Uses module-level debounce so repeated page navigations within the
 * cooldown window don't stack up cold starts or costs.
 *
 * Warmup is intentionally fire-and-forget — it submits a minimal job to wake
 * the GPU and returns immediately. There is no timeout or AbortController
 * because waiting for GPU warmup would trigger ERR_NETWORK_CHANGED on cold
 * RunPod endpoints (10-30s startup). The .catch() silently absorbs any
 * network-level failures (page navigation, Vercel cold starts, etc.) since
 * warmup is best-effort.
 */
function pingTTSWarmup(): void {
  const now = Date.now()
  if (now - lastWarmupTime < WARMUP_COOLDOWN_MS) return

  // Deduplicate in-flight warmups across concurrent hook instances
  if (pendingWarmup) return

  lastWarmupTime = now

  const warmupUrl = '/api/voice/warmup'

  pendingWarmup = fetch(warmupUrl, {
    method: 'POST',
  })
    .then(() => {
      // GPU is now warming — no action needed
    })
    .catch(() => {
      // Silently ignore — warmup is best-effort. The real request will retry.
    })
    .finally(() => {
      pendingWarmup = null
    })
}

/**
 * Hook: pre-warms the TTS container when a component mounts.
 * Use on pages/components that are entry points to TTS features:
 * - Voice Lab (voice cloning, profile creation)
 * - Story pages without existing narration
 * - Profile pages with voice signature CTAs
 *
 * Smart intent triggers:
 * 1. Voice Lab: instant warm (high intent)
 * 2. Story page: warm if no narration yet (medium intent)
 * 3. Profile: warm on scroll to voice section (low intent)
 *
 * Debounced to once per 5 minutes across the entire session —
 * rapid navigation won't trigger redundant warmup calls.
 */
export function useTTSWarmup(enabled = true, intent: 'high' | 'medium' | 'low' = 'medium'): void {
  const firedRef = useRef(false)

  useEffect(() => {
    if (!enabled || firedRef.current) return
    firedRef.current = true

    // Delay based on intent level:
    // - high: immediate (200ms) — user is actively engaging with TTS
    // - medium: moderate (500ms) — user might use TTS
    // - low: delayed (1500ms) — only warm if user lingers on page
    const delays = { high: 200, medium: 500, low: 1500 }
    const delay = delays[intent]

    const timer = setTimeout(() => pingTTSWarmup(), delay)
    return () => clearTimeout(timer)
  }, [enabled, intent])
}
