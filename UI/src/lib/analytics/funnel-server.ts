import { logger } from '@/lib/logger'
import { incrementFunnelCounter } from '@/lib/analytics/funnel-counters'
import type {
  CheckoutBlockedReason,
  FunnelEventName,
  FunnelServerEventName,
} from '@/lib/analytics/funnel-steps'
import {
  FUNNEL_EVENTS,
  FUNNEL_SERVER_EVENTS,
  normalizePlanSlug,
} from '@/lib/analytics/funnel-steps'

/**
 * First-party funnel sink.
 *
 * Vercel Web Analytics custom events (`track()`) are documented as Enterprise
 * and Pro only, and this project is not approved for that spend, so a
 * `track()`-only funnel may record nothing at all. Every step therefore also
 * lands here, in two forms:
 *
 * - one structured log line, greppable by the `funnel` marker:
 *     {"evt":"funnel","step":"pay_5_checkout_opened","plan":"cloud_mid",...}
 * - a Redis counter per UTC day, readable through /api/admin/funnel-counts
 *
 * The log line is the detailed record but needs Vercel dashboard access to
 * read. The counter is what makes a step count answerable without it.
 */

const FUNNEL_MARKER = 'funnel'

export type FunnelProperty = string | number | boolean | null
export type FunnelProperties = Record<string, FunnelProperty>

/**
 * Deliberately no user id, email, IP, or Stripe identifier. This stream exists
 * to count steps; attaching anything that identifies a grieving family or their
 * payment details would make a counter into a privacy liability.
 */
export function recordFunnelEvent(
  step: FunnelEventName | FunnelServerEventName,
  properties: FunnelProperties = {}
): void {
  try {
    logger.info({ evt: FUNNEL_MARKER, step, ...properties }, `[funnel] ${step}`)
  } catch {
    // A funnel counter must never be able to fail a request.
  }

  // Normalized again rather than trusted: this also runs for events posted by
  // the browser, where `plan` has been through the wire. Step 6 carries
  // `planName` instead, because the return trip from Stripe drops the slug.
  incrementFunnelCounter(step, normalizePlanSlug(properties.plan ?? properties.planName))
}

/** Step 5 — `/api/billing/subscribe` returned a usable Stripe checkout. */
export function recordCheckoutOpened(args: {
  plan: unknown
  billingCycle: string
  isEmbedded: boolean
}): void {
  recordFunnelEvent(FUNNEL_EVENTS.checkoutOpened, {
    plan: normalizePlanSlug(args.plan),
    billingCycle: args.billingCycle,
    source: 'server',
    embedded: args.isEmbedded,
  })
}

/** Step 5 negative case — the subscribe call could not produce a checkout. */
export function recordCheckoutBlocked(args: {
  plan: unknown
  billingCycle?: string
  reason: CheckoutBlockedReason
}): void {
  recordFunnelEvent(FUNNEL_SERVER_EVENTS.checkoutBlocked, {
    plan: normalizePlanSlug(args.plan),
    billingCycle: args.billingCycle ?? 'unknown',
    source: 'server',
    reason: args.reason,
  })
}
