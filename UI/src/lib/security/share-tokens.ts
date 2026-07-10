import crypto from 'crypto'

/**
 * Share-link helpers for public story/person links (see docs/sharing.md).
 * Both `Story` and `Person` use the same shape: a unique `shareToken`
 * string plus an optional `shareTokenExpiresAt` — `null` means "never expires".
 */

export const SHARE_EXPIRY_OPTIONS = ['never', '24h', '7d', '30d'] as const
export type ShareExpiryOption = (typeof SHARE_EXPIRY_OPTIONS)[number]

export function isShareExpiryOption(value: unknown): value is ShareExpiryOption {
  return typeof value === 'string' && (SHARE_EXPIRY_OPTIONS as readonly string[]).includes(value)
}

export function generateShareToken(): string {
  return crypto.randomBytes(24).toString('base64url')
}

export function computeShareExpiry(option: ShareExpiryOption): Date | null {
  const now = Date.now()
  switch (option) {
    case '24h':
      return new Date(now + 24 * 60 * 60 * 1000)
    case '7d':
      return new Date(now + 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now + 30 * 24 * 60 * 60 * 1000)
    case 'never':
    default:
      return null
  }
}

/**
 * Constant-time string comparison to avoid leaking token match progress via
 * response-time side channels. Falls back to `false` (not a match) whenever
 * lengths differ — that alone doesn't leak anything a random 192-bit token
 * couldn't already have arbitrarily.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Validates a share link presented by an anonymous visitor: the token must
 * match exactly and, if an expiry is set, must not be in the past.
 */
export function isShareLinkValid(
  storedToken: string | null | undefined,
  storedExpiresAt: Date | null | undefined,
  providedToken: string | string[] | undefined
): boolean {
  if (!storedToken || !providedToken) return false
  const token = Array.isArray(providedToken) ? providedToken[0] : providedToken
  if (!token || !timingSafeEqual(token, storedToken)) return false
  if (storedExpiresAt && storedExpiresAt.getTime() < Date.now()) return false
  return true
}
