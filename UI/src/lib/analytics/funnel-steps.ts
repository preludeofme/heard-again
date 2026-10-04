/**
 * Shared vocabulary for the pay funnel, with no runtime dependencies, so the
 * browser sender and the server-side recorder agree on names without the
 * client pulling in pino or the server pulling in `@vercel/analytics`.
 */

/**
 * The six steps between a pricing click and cleared money. Numbered so the
 * Vercel Analytics events list, which sorts alphabetically, reads as the funnel
 * in order without any extra tooling.
 */
export const FUNNEL_EVENTS = {
  planSelected: 'pay_1_plan_selected',
  signupFormViewed: 'pay_2_signup_form_viewed',
  onboardingCompleted: 'pay_3_onboarding_completed',
  mfaWallHit: 'pay_4_mfa_wall_hit',
  checkoutOpened: 'pay_5_checkout_opened',
  checkoutCompleted: 'pay_6_checkout_completed',
} as const

export type FunnelEventName = (typeof FUNNEL_EVENTS)[keyof typeof FUNNEL_EVENTS]

export const FUNNEL_EVENT_NAMES = Object.values(FUNNEL_EVENTS) as readonly FunnelEventName[]

export function isFunnelEventName(value: unknown): value is FunnelEventName {
  return typeof value === 'string' && (FUNNEL_EVENT_NAMES as readonly string[]).includes(value)
}

/**
 * Why a step-5 checkout attempt never produced a Stripe clientSecret. Recorded
 * so a leak between "clicked subscribe" and "Stripe rendered" has a cause
 * instead of just a missing count.
 */
export const CHECKOUT_BLOCKED_REASONS = {
  validationFailed: 'validation_failed',
  planNotFound: 'plan_not_found',
  billingCycleUnsupported: 'billing_cycle_unsupported',
  stripeError: 'stripe_error',
} as const

export type CheckoutBlockedReason =
  (typeof CHECKOUT_BLOCKED_REASONS)[keyof typeof CHECKOUT_BLOCKED_REASONS]

/**
 * Server-only step markers. Kept out of `FUNNEL_EVENTS` so the browser cannot
 * post them and so counting `pay_5_checkout_opened` never silently includes
 * attempts that failed.
 */
export const FUNNEL_SERVER_EVENTS = {
  checkoutBlocked: 'pay_5_checkout_blocked',
} as const

export type FunnelServerEventName =
  (typeof FUNNEL_SERVER_EVENTS)[keyof typeof FUNNEL_SERVER_EVENTS]

/** Where a plan click came from, so landing and /pricing can be told apart. */
export type FunnelSurface = 'landing' | 'pricing_page' | 'other'

const KNOWN_PLAN_SLUGS = ['cloud_lite', 'cloud_min', 'cloud_mid', 'cloud_max'] as const

/**
 * Keep the property's cardinality low. An arbitrary query-string value would
 * fragment the per-tier breakdown into noise.
 */
export function normalizePlanSlug(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return 'none'
  return (KNOWN_PLAN_SLUGS as readonly string[]).includes(value) ? value : 'unknown'
}

export function surfaceForPath(pathname: string): FunnelSurface {
  if (pathname === '/pricing') return 'pricing_page'
  if (pathname === '/') return 'landing'
  return 'other'
}
