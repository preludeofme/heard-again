import { logger } from '@/lib/logger'

/**
 * Cloudflare Turnstile verification for anonymous, public-facing form
 * submissions (see docs/sharing.md — "verify the user" for public story
 * submissions). Optional: if `TURNSTILE_SECRET_KEY` isn't set, verification
 * is skipped with a warning log rather than blocking submissions outright —
 * same "reserved for future setup, no-op until configured" pattern already
 * used for CHAT_SERVICE_URL/SECRET elsewhere in this codebase. Rate limiting
 * (see the `public` bucket in rate-limiter.ts) is the fallback spam control
 * until this is configured.
 */
export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp?: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY

  if (!secret) {
    logger.warn(
      'TURNSTILE_SECRET_KEY not set — skipping CAPTCHA verification for this public submission. ' +
      'Set TURNSTILE_SECRET_KEY (and NEXT_PUBLIC_TURNSTILE_SITE_KEY) to enable it.'
    )
    return true
  }

  if (!token) {
    return false
  }

  try {
    const body = new URLSearchParams({ secret, response: token })
    if (remoteIp) body.set('remoteip', remoteIp)

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    if (!response.ok) {
      logger.warn(`Turnstile verification request failed: ${response.status}`)
      return false
    }

    const data = await response.json()
    return data.success === true
  } catch (error) {
    logger.error('Turnstile verification error:', error)
    return false
  }
}
