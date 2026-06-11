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

/**\n * Hook: pre-warms the TTS container when a component mounts.\n * Use on pages/components that are entry points to TTS features:\n * - Voice Lab (voice cloning, profile creation)\n * - Story pages without existing narration\n * - Profile pages with voice signature CTAs\n *\n * Smart intent triggers:\n * 1. Voice Lab: instant warm (high intent)\n * 2. Story page: warm if no narration yet (medium intent)\n * 3. Profile: warm on scroll to voice section (low intent)\n *\n * Debounced to once per 5 minutes across the entire session —\n * rapid navigation won't trigger redundant warmup calls.\n */\nexport function useTTSWarmup(enabled = true, intent: 'high' | 'medium' | 'low' = 'medium'): void {\n  const firedRef = useRef(false)\n\n  useEffect(() => {\n    if (!enabled || firedRef.current) return\n    firedRef.current = true\n\n    // Delay based on intent level:\n    // - high: immediate (200ms) — user is actively engaging with TTS\n    // - medium: moderate (500ms) — user might use TTS\n    // - low: delayed (1500ms) — only warm if user lingers on page\n    const delays = { high: 200, medium: 500, low: 1500 }\n    const delay = delays[intent]\n\n    const timer = setTimeout(() => pingTTSWarmup(), delay)\n    return () => clearTimeout(timer)\n  }, [enabled, intent])\n}
