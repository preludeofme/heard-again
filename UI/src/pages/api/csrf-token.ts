import { logger } from '@/lib/logger'
import crypto from 'crypto'
import { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { successResponse, errorResponse } from '@/lib/api-helpers'

import { generateCSRFToken, setCSRFCookie } from '@/lib/security/csrf'

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

    const token = generateCSRFToken()
    setCSRFCookie(res, token)

    return successResponse(res, { csrfToken: token })
  } catch (error) {
    logger.error('CSRF token generation error:', error)
    return errorResponse(res, 'Failed to generate CSRF token', 500, 'CSRF_ERROR')
  }
}
