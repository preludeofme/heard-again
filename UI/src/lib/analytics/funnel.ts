import { track } from '@vercel/analytics'
import type { FunnelEventName, FunnelSurface } from '@/lib/analytics/funnel-steps'
import { FUNNEL_EVENTS, normalizePlanSlug, surfaceForPath } from '@/lib/analytics/funnel-steps'

export type { FunnelEventName, FunnelSurface }
export { FUNNEL_EVENTS, normalizePlanSlug, surfaceForPath }

type FunnelProperties = Record<string, string | number | boolean | null>

/** Where `sendToFirstParty` posts. Mirrors `pages/api/analytics/funnel.ts`. */
const FIRST_PARTY_ENDPOINT = '/api/analytics/funnel'

/**
 * Vercel Web Analytics custom events are documented as Enterprise and Pro
 * only, and this project has no approved spend for that, so `track()` alone
 * may record nothing we can ever read. Every step is therefore also posted to
 * our own endpoint, which writes a structured log line at no cost. Two sinks,
 * one call site: whichever one we can actually read is the one we use.
 */
function sendToFirstParty(name: FunnelEventName, properties: FunnelProperties): void {
  if (typeof window === 'undefined') return

  const body = JSON.stringify({
    event: name,
    properties,
    path: window.location.pathname,
  })

  try {
    // sendBeacon survives the navigation a plan click immediately causes;
    // a plain fetch would be cancelled mid-flight and the step would vanish.
    if (typeof navigator.sendBeacon === 'function') {
      const queued = navigator.sendBeacon(
        FIRST_PARTY_ENDPOINT,
        new Blob([body], { type: 'application/json' })
      )
      if (queued) return
    }

    void fetch(FIRST_PARTY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => undefined)
  } catch {
    // Analytics never blocks the pay path.
  }
}

/**
 * Analytics must never be able to break the pay path, so every send is
 * swallowed here. A dropped event costs a data point; a thrown one costs a
 * customer.
 */
function send(name: FunnelEventName, properties: FunnelProperties): void {
  try {
    track(name, properties)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[funnel] failed to send ${name}`, error)
    }
  }

  sendToFirstParty(name, properties)
}

/**
 * Fire-once guard for events triggered by a mount or a render, which React can
 * repeat (Strict Mode in dev, remounts in production). Scoped to the tab so a
 * genuinely new visit in a new tab still counts. Click events deliberately do
 * not use this — two clicks are two real clicks.
 */
function sendOnce(name: FunnelEventName, properties: FunnelProperties, dedupeKey: string): void {
  if (typeof window === 'undefined') return
  const storageKey = `ha_funnel:${name}:${dedupeKey}`
  try {
    if (window.sessionStorage.getItem(storageKey) === '1') return
    window.sessionStorage.setItem(storageKey, '1')
  } catch {
    // Private-browsing or storage-disabled: accept the duplicate rather than
    // losing the step entirely.
  }
  send(name, properties)
}

/**
 * Step 1 — a pricing card's CTA was clicked. `card` and `plan` differ on the
 * Lite card, whose CTA deliberately routes to Starter because Lite cannot be
 * sold yet; recording both is what makes that diversion measurable.
 */
export function trackPlanSelected(args: {
  card: string
  plan: string
  surface: FunnelSurface
}): void {
  send(FUNNEL_EVENTS.planSelected, {
    card: normalizePlanSlug(args.card),
    plan: normalizePlanSlug(args.plan),
    surface: args.surface,
  })
}

/** Step 2 — the account-creation form was reached. */
export function trackSignupFormViewed(plan: unknown): void {
  const normalized = normalizePlanSlug(plan)
  sendOnce(FUNNEL_EVENTS.signupFormViewed, { plan: normalized }, normalized)
}

/** Step 3 — onboarding finished; `hasPlan` separates paid intent from free. */
export function trackOnboardingCompleted(plan: unknown): void {
  const normalized = normalizePlanSlug(plan)
  send(FUNNEL_EVENTS.onboardingCompleted, {
    plan: normalized,
    hasPlan: normalized !== 'none',
  })
}

/**
 * Step 4 — the mandatory-MFA screen was shown instead of the page asked for.
 * Credentials-signup owners hit this wall everywhere except /account and
 * /support; Google signups are exempt.
 */
export function trackMfaWallHit(pathname: string): void {
  sendOnce(FUNNEL_EVENTS.mfaWallHit, { path: pathname }, pathname)
}

/** Step 5 — Stripe Embedded Checkout rendered with a live clientSecret. */
export function trackCheckoutOpened(plan: unknown): void {
  const normalized = normalizePlanSlug(plan)
  sendOnce(FUNNEL_EVENTS.checkoutOpened, { plan: normalized }, normalized)
}

/**
 * Step 6 — Stripe returned the visitor to /account with a session_id and the
 * subscription read back. `planName` not a slug: the return trip drops
 * pendingPlan, so the plan is recovered from the subscription record.
 */
export function trackCheckoutCompleted(planName: string | null): void {
  sendOnce(
    FUNNEL_EVENTS.checkoutCompleted,
    { planName: planName ?? 'unknown' },
    planName ?? 'unknown'
  )
}
