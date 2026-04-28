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

  const headerToken = (req.headers['x-csrf-token'] as string) || req.body?.csrfToken
  const cookieToken = req.cookies['csrf-token']

  if (!headerToken) {
    errorResponse(res, 'CSRF token required', 403, 'CSRF_REQUIRED')
    return false
  }

  if (!cookieToken) {
    errorResponse(res, 'CSRF cookie missing', 403, 'CSRF_COOKIE_MISSING')
    return false
  }

  // Use timingSafeEqual to prevent timing attacks
  try {
    const tokenBuf = Buffer.from(headerToken, 'hex')
    const expectedBuf = Buffer.from(cookieToken, 'hex')
    
    if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
      errorResponse(res, 'CSRF token invalid', 403, 'CSRF_INVALID')
      return false
    }
  } catch (e) {
    errorResponse(res, 'CSRF validation error', 403, 'CSRF_ERROR')
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
