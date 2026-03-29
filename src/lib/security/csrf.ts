import crypto from 'crypto'
import { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { errorResponse } from '../api-helpers'
import { redis } from '../redis-client'

/**
 * Generate a CSRF token for the session
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Store CSRF token in Redis for server-side validation
 * Binds token to both user ID and session ID for enhanced security
 */
export async function storeCSRFToken(sessionId: string, token: string, userId?: string): Promise<void> {
  // Use user+session binding if user ID is available, otherwise fall back to session only
  const key = userId ? `csrf:${userId}:${sessionId}` : `csrf:${sessionId}`
  await redis.setex(key, 28800, token) // 8 hours TTL to match session
}

/**
 * Validate CSRF token for state-changing requests
 */
export async function validateCSRFToken(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<boolean> {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
    return true
  }

  // Get token from header or body
  const token = req.headers['x-csrf-token'] as string || 
               req.body?.csrfToken

  if (!token) {
    errorResponse(res, 'CSRF token required', 403, 'CSRF_REQUIRED')
    return false
  }

  // Basic format validation
  if (token.length !== 64 || !/^[a-f0-9]{64}$/i.test(token)) {
    errorResponse(res, 'Invalid CSRF token format', 403, 'CSRF_INVALID')
    return false
  }

  // Get the session token
  const sessionToken = await getToken({ 
    req, 
    secret: process.env.NEXTAUTH_SECRET 
  })

  if (!sessionToken?.id) {
    errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED')
    return false
  }

  // Try user+session bound key first (enhanced security)
  const userSessionKey = `csrf:${sessionToken.sub}:${sessionToken.id}`
  let storedToken = await redis.get(userSessionKey)
  
  // Fallback to session-only key for backward compatibility
  if (!storedToken) {
    const sessionKey = `csrf:${sessionToken.id}`
    storedToken = await redis.get(sessionKey)
  }

  if (!storedToken || storedToken !== token) {
    errorResponse(res, 'CSRF token invalid or expired', 403, 'CSRF_INVALID')
    return false
  }

  // Optional: Rotate token after use (one-time token)
  // For now, keep token valid for session duration
  // await redis.del(key)

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
