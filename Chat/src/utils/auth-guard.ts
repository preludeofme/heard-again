import { NextApiRequest, NextApiResponse } from 'next'

/**
 * Verify the CHAT_SERVICE_SECRET bearer token on every Chat service route.
 * Must be called before any business logic to prevent unauthorized access.
 * Returns true if authorized, false (and writes 401) if not.
 */
export function verifyServiceToken(req: NextApiRequest, res: NextApiResponse): boolean {
  const secret = process.env.CHAT_SERVICE_SECRET

  if (!secret) {
    console.error('[AUTH] CHAT_SERVICE_SECRET is not configured — denying all requests')
    res.status(500).json({ error: 'Service misconfigured' })
    return false
  }

  const authHeader = req.headers['authorization']
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

  if (!token || token !== secret) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }

  return true
}
