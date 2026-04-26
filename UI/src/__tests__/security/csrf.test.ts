import crypto from 'crypto'
import { NextApiRequest, NextApiResponse } from 'next'
import { generateCSRFToken, validateCSRFToken, withCSRFProtection } from '@/lib/security/csrf'
import { getToken } from 'next-auth/jwt'

jest.mock('next-auth/jwt')

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>

const SESSION_ID = 'session-id'
const USER_SUB = 'user-sub'

function deriveValidToken(): string {
  return crypto
    .createHmac('sha256', process.env.NEXTAUTH_SECRET as string)
    .update(`${USER_SUB}:${SESSION_ID}`)
    .digest('hex')
}

describe('CSRF Protection (stateless HMAC)', () => {
  let mockReq: Partial<NextApiRequest>
  let mockRes: Partial<NextApiResponse>

  beforeEach(() => {
    mockReq = { method: 'POST', headers: {}, body: {} }
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    }
    mockGetToken.mockResolvedValue({ id: SESSION_ID, sub: USER_SUB })
  })

  describe('generateCSRFToken', () => {
    it('returns a 64-char hex string', () => {
      const token = generateCSRFToken()
      expect(token).toMatch(/^[a-f0-9]{64}$/i)
    })

    it('returns a unique value on each call', () => {
      expect(generateCSRFToken()).not.toBe(generateCSRFToken())
    })
  })

  describe('validateCSRFToken', () => {
    it.each(['GET', 'HEAD', 'OPTIONS'] as const)('skips %s requests', async (method) => {
      mockReq.method = method
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      expect(result).toBe(true)
      expect(mockRes.status).not.toHaveBeenCalled()
    })

    it('rejects POST when no token is present', async () => {
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      expect(result).toBe(false)
      expect(mockRes.status).toHaveBeenCalledWith(403)
    })

    it('rejects POST when the user is not authenticated', async () => {
      mockReq.headers = { 'x-csrf-token': deriveValidToken() }
      mockGetToken.mockResolvedValue(null)
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      expect(result).toBe(false)
      expect(mockRes.status).toHaveBeenCalledWith(401)
    })

    it('rejects a token that does not match the HMAC-derived expected value', async () => {
      mockReq.headers = { 'x-csrf-token': '00'.repeat(32) }
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      expect(result).toBe(false)
      expect(mockRes.status).toHaveBeenCalledWith(403)
    })

    it('accepts a valid HMAC-derived token in the header', async () => {
      mockReq.headers = { 'x-csrf-token': deriveValidToken() }
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      expect(result).toBe(true)
      expect(mockRes.status).not.toHaveBeenCalled()
    })

    it('accepts a valid HMAC-derived token in the body', async () => {
      mockReq.body = { csrfToken: deriveValidToken() }
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      expect(result).toBe(true)
    })

    it('uses constant-time comparison (rejects mismatched length without crashing)', async () => {
      mockReq.headers = { 'x-csrf-token': 'abc' }
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      expect(result).toBe(false)
      expect(mockRes.status).toHaveBeenCalledWith(403)
    })
  })

  describe('withCSRFProtection', () => {
    it('invokes the wrapped handler when CSRF passes', async () => {
      mockReq.headers = { 'x-csrf-token': deriveValidToken() }
      const inner = jest.fn().mockResolvedValue(undefined)

      await withCSRFProtection(inner)(mockReq as NextApiRequest, mockRes as NextApiResponse)

      expect(inner).toHaveBeenCalledWith(mockReq, mockRes)
    })

    it('does not invoke the wrapped handler when CSRF fails', async () => {
      const inner = jest.fn().mockResolvedValue(undefined)

      await withCSRFProtection(inner)(mockReq as NextApiRequest, mockRes as NextApiResponse)

      expect(inner).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(403)
    })
  })
})
