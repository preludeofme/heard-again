import crypto from 'crypto'
import { NextApiRequest, NextApiResponse } from 'next'
import { generateCSRFToken, validateCSRFToken, withCSRFProtection } from '@/lib/security/csrf'

describe('CSRF Protection (Double-Submit Cookie)', () => {
  let mockReq: Partial<NextApiRequest>
  let mockRes: Partial<NextApiResponse>

  beforeEach(() => {
    mockReq = { method: 'POST', headers: {}, body: {}, cookies: {} }
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    }
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

    it('rejects POST when no token is present in header/body', async () => {
      mockReq.cookies = { 'csrf-token': 'a'.repeat(64) }
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      expect(result).toBe(false)
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'CSRF token required' }))
    })

    it('rejects POST when CSRF cookie is missing', async () => {
      mockReq.headers = { 'x-csrf-token': 'a'.repeat(64) }
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      expect(result).toBe(false)
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'CSRF cookie missing' }))
    })

    it('rejects a token that does not match the cookie token', async () => {
      mockReq.headers = { 'x-csrf-token': 'a'.repeat(64) }
      mockReq.cookies = { 'csrf-token': 'b'.repeat(64) }
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      expect(result).toBe(false)
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'CSRF token invalid' }))
    })

    it('accepts a valid matching token in the header', async () => {
      const token = 'a'.repeat(64)
      mockReq.headers = { 'x-csrf-token': token }
      mockReq.cookies = { 'csrf-token': token }
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      expect(result).toBe(true)
      expect(mockRes.status).not.toHaveBeenCalled()
    })

    it('accepts a valid matching token in the body', async () => {
      const token = 'a'.repeat(64)
      mockReq.body = { csrfToken: token }
      mockReq.cookies = { 'csrf-token': token }
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      expect(result).toBe(true)
      expect(mockRes.status).not.toHaveBeenCalled()
    })

    it('uses constant-time comparison (rejects mismatched length without crashing)', async () => {
      mockReq.headers = { 'x-csrf-token': 'abc' }
      mockReq.cookies = { 'csrf-token': 'def' }
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      expect(result).toBe(false)
      expect(mockRes.status).toHaveBeenCalledWith(403)
    })
  })

  describe('withCSRFProtection', () => {
    it('invokes the wrapped handler when CSRF passes', async () => {
      const token = 'a'.repeat(64)
      mockReq.headers = { 'x-csrf-token': token }
      mockReq.cookies = { 'csrf-token': token }
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
