import {
  generateShareToken,
  computeShareExpiry,
  isShareLinkValid,
  isShareExpiryOption,
  SHARE_EXPIRY_OPTIONS,
} from '@/lib/security/share-tokens'

describe('share-tokens', () => {
  describe('generateShareToken', () => {
    it('returns a high-entropy, URL-safe token', () => {
      const token = generateShareToken()
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(token.length).toBeGreaterThanOrEqual(32)
    })

    it('returns a unique value on each call', () => {
      expect(generateShareToken()).not.toBe(generateShareToken())
    })
  })

  describe('isShareExpiryOption', () => {
    it.each(SHARE_EXPIRY_OPTIONS)('accepts %s', (option) => {
      expect(isShareExpiryOption(option)).toBe(true)
    })

    it.each([undefined, null, 42, 'forever', ''])('rejects %p', (value) => {
      expect(isShareExpiryOption(value)).toBe(false)
    })
  })

  describe('computeShareExpiry', () => {
    it('returns null for "never"', () => {
      expect(computeShareExpiry('never')).toBeNull()
    })

    it.each([
      ['24h', 24 * 60 * 60 * 1000],
      ['7d', 7 * 24 * 60 * 60 * 1000],
      ['30d', 30 * 24 * 60 * 60 * 1000],
    ] as const)('returns a date ~%s (%dms) in the future', (option, ms) => {
      const before = Date.now()
      const result = computeShareExpiry(option)
      const after = Date.now()
      expect(result).not.toBeNull()
      expect(result!.getTime()).toBeGreaterThanOrEqual(before + ms)
      expect(result!.getTime()).toBeLessThanOrEqual(after + ms)
    })
  })

  describe('isShareLinkValid', () => {
    const token = generateShareToken()

    it('rejects when there is no stored token', () => {
      expect(isShareLinkValid(null, null, token)).toBe(false)
      expect(isShareLinkValid(undefined, null, token)).toBe(false)
    })

    it('rejects when no token is provided', () => {
      expect(isShareLinkValid(token, null, undefined)).toBe(false)
    })

    it('rejects a mismatched token', () => {
      expect(isShareLinkValid(token, null, 'wrong-token')).toBe(false)
    })

    it('rejects a token of a different length than stored', () => {
      expect(isShareLinkValid(token, null, token.slice(0, -1))).toBe(false)
    })

    it('accepts an exact match with no expiry', () => {
      expect(isShareLinkValid(token, null, token)).toBe(true)
    })

    it('unwraps an array-valued query param and matches the first entry', () => {
      expect(isShareLinkValid(token, null, [token, 'other'])).toBe(true)
    })

    it('accepts a match with a future expiry', () => {
      const future = new Date(Date.now() + 60_000)
      expect(isShareLinkValid(token, future, token)).toBe(true)
    })

    it('rejects a match with a past expiry', () => {
      const past = new Date(Date.now() - 60_000)
      expect(isShareLinkValid(token, past, token)).toBe(false)
    })
  })
})
