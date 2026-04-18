import { logger } from '@/lib/logger'
import crypto from 'crypto'
import { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { successResponse, errorResponse } from '@/lib/api-helpers'

const _csrfSecret = process.env.NEXTAUTH_SECRET
if (!_csrfSecret) throw new Error('NEXTAUTH_SECRET is required for CSRF protection')
const CSRF_SECRET: string = _csrfSecret

function deriveToken(sessionId: string, userId?: string): string {
  const payload = userId ? `${userId}:${sessionId}` : sessionId
  return crypto.createHmac('sha256', CSRF_SECRET).update(payload).digest('hex')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return errorResponse(res, 'Method not allowed', 405)
  }

  try {
    const sessionToken = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!sessionToken) {
      return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED')
    }

    const sessionId = (sessionToken.id as string) || (sessionToken.sub as string) || ''
    const token = deriveToken(sessionId, sessionToken.sub as string | undefined)

    return successResponse(res, { csrfToken: token })
  } catch (error) {
    logger.error('CSRF token generation error:', error)
    return errorResponse(res, 'Failed to generate CSRF token', 500, 'CSRF_ERROR')
  }
}
