import crypto from 'crypto'
import { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { errorResponse } from '../api-helpers'

const _csrfSecret = process.env.NEXTAUTH_SECRET
if (!_csrfSecret) throw new Error('NEXTAUTH_SECRET is required for CSRF protection')
const CSRF_SECRET: string = _csrfSecret

/**
 * Derive a deterministic CSRF token from session identifiers using HMAC.
 * Stateless — no Redis required.
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

function deriveToken(sessionId: string, userId?: string): string {
  const payload = userId ? `${userId}:${sessionId}` : sessionId
  return crypto.createHmac('sha256', CSRF_SECRET).update(payload).digest('hex')
}

/**
 * No-op — kept for API compatibility. Tokens are now stateless (HMAC-derived).
 */
export async function storeCSRFToken(_sessionId: string, _token: string, _userId?: string): Promise<void> {
  // Stateless — nothing to store
}

/**
 * Validate CSRF token for state-changing requests.
 */
export async function validateCSRFToken(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<boolean> {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
    return true
  }

  const token = (req.headers['x-csrf-token'] as string) || req.body?.csrfToken

  if (!token) {
    errorResponse(res, 'CSRF token required', 403, 'CSRF_REQUIRED')
    return false
  }

  const sessionToken = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!sessionToken) {
    errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED')
    return false
  }

  const sessionId = (sessionToken.id as string) || (sessionToken.sub as string) || ''
  const expected = deriveToken(sessionId, sessionToken.sub as string | undefined)

  const tokenBuf = Buffer.from(token, 'hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
    errorResponse(res, 'CSRF token invalid', 403, 'CSRF_INVALID')
    return false
  }

  return true
}

/**
 * CSRF protection middleware wrapper
 */
export function withCSRFProtection(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const isValid = await validateCSRFToken(req, res)
    if (!isValid) {
      return // Error already sent by validateCSRFToken
    }

    await handler(req, res)
  }
}

/**
 * Set CSRF cookie for client-side access
 */
export function setCSRFCookie(res: NextApiResponse, token: string) {
  res.setHeader('Set-Cookie', [
    `csrf-token=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=28800` // 8 hours
  ])
}
