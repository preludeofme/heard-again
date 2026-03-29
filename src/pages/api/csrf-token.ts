import { NextApiRequest, NextApiResponse } from 'next'
import { generateCSRFToken, storeCSRFToken, setCSRFCookie } from '@/lib/security/csrf'
import { getToken } from 'next-auth/jwt'
import { successResponse, errorResponse } from '@/lib/api-helpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return errorResponse(res, 'Method not allowed', 405)
  }

  try {
    // Get the session token (may be unauthenticated for sign-in flow)
    const sessionToken = await getToken({ 
      req, 
      secret: process.env.NEXTAUTH_SECRET 
    })

    // Use session ID if available, otherwise fall back to a temporary session identifier
    // This allows CSRF protection during sign-in flow before authentication
    const sessionId = sessionToken?.id || sessionToken?.sub || req.cookies['next-auth.session-token']?.slice(0, 32) || generateCSRFToken()
    
    // Generate and store CSRF token
    const token = generateCSRFToken()
    await storeCSRFToken(sessionId, token, sessionToken?.sub)
    
    // Set cookie for client-side access (HttpOnly for security)
    setCSRFCookie(res, token)

    return successResponse(res, { csrfToken: token })
  } catch (error) {
    console.error('CSRF token generation error:', error)
    return errorResponse(res, 'Failed to generate CSRF token', 500, 'CSRF_ERROR')
  }
}
