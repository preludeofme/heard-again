/**
 * Buyer-facing copy for a checkout that could not start.
 *
 * POST /api/billing/subscribe fails with 401 (sign-in gone), 403 (not the
 * familyspace owner, or two-factor still required), 404 (plan inactive or unknown
 * slug), 400 (no Stripe price for that billing cycle), 429 (rate limited) or 5xx
 * (Stripe unreachable). Every message says no charge was made, because none was:
 * the Checkout Session is created only on success.
 */
export function describeCheckoutFailure(status: number, serverMessage?: string): string {
  const mentionsMfa = /two-factor|2fa|mfa|authenticator/i.test(serverMessage || '')

  if (status === 401) {
    return 'Your sign-in expired before the payment form opened. Nothing has been charged — sign in again and pick your plan.'
  }
  if (status === 403) {
    if (mentionsMfa) {
      return 'Set up two-factor security on the Security tab first, then come back here to finish. Nothing has been charged.'
    }
    return `${serverMessage || 'You do not have permission to change this plan.'} Only the familyspace owner can start a subscription. Nothing has been charged.`
  }
  if (status === 404) {
    return 'That plan is not open for cloud checkout right now. Nothing has been charged — pick another plan from the list below.'
  }
  if (status === 429) {
    return 'Too many attempts in a row. Nothing has been charged — wait a minute and try again.'
  }
  if (status >= 500) {
    return 'We could not reach the payment processor. Nothing has been charged — please try again in a moment.'
  }
  return `${serverMessage || 'The payment form could not be opened.'} Nothing has been charged.`
}

/** "cloud_lite" -> "Cloud Lite", for naming a plan slug we cannot look up. */
export function formatPlanSlug(slug: string): string {
  return slug
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
