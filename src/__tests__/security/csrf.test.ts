import { NextApiRequest, NextApiResponse } from 'next'
import { generateCSRFToken, storeCSRFToken, validateCSRFToken, withCSRFProtection } from '@/lib/security/csrf'
import { getToken } from 'next-auth/jwt'
import { redis } from '@/lib/redis-client'
import { errorResponse } from '@/lib/api-helpers'

// Mock dependencies
jest.mock('next-auth/jwt')
jest.mock('@/lib/redis-client')
jest.mock('@/lib/api-helpers')

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>
const mockRedis = redis as jest.Mocked<typeof redis>
const mockErrorResponse = errorResponse as jest.MockedFunction<typeof errorResponse>

describe('CSRF Protection', () => {
  let mockReq: Partial<NextApiRequest>
  let mockRes: Partial<NextApiResponse>

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockReq = {
      method: 'POST',
      headers: {},
      body: {},
    }
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    }
  })

  describe('generateCSRFToken', () => {
    it('should generate a 64-character hex token', () => {
      const token = generateCSRFToken()
      
      expect(token).toMatch(/^[a-f0-9]{64}$/i)
      expect(token).toHaveLength(64)
    })

    it('should generate unique tokens', () => {
      const token1 = generateCSRFToken()
      const token2 = generateCSRFToken()
      
      expect(token1).not.toBe(token2)
    })
  })

  describe('storeCSRFToken', () => {
    it('should store token in Redis with correct key and TTL (session only)', async () => {
      const sessionId = 'user-session-123'
      const token = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      
      mockRedis.setex = jest.fn().mockResolvedValue(undefined)
      
      await storeCSRFToken(sessionId, token)
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `csrf:${sessionId}`,
        28800, // 8 hours
        token
      )
    })

    it('should store token in Redis with user+session binding when user ID provided', async () => {
      const sessionId = 'user-session-123'
      const userId = 'user-456'
      const token = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      
      mockRedis.setex = jest.fn().mockResolvedValue(undefined)
      
      await storeCSRFToken(sessionId, token, userId)
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `csrf:${userId}:${sessionId}`,
        28800, // 8 hours
        token
      )
    })
  })

  describe('validateCSRFToken', () => {
    const validToken = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    const sessionId = 'user-session-123'

    beforeEach(() => {
      mockGetToken.mockResolvedValue({
        id: sessionId,
        sub: 'user-456',
        email: 'test@example.com',
      })
    })

    it('should allow GET requests without CSRF token', async () => {
      mockReq.method = 'GET'
      
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      
      expect(result).toBe(true)
      expect(mockErrorResponse).not.toHaveBeenCalled()
    })

    it('should allow HEAD requests without CSRF token', async () => {
      mockReq.method = 'HEAD'
      
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      
      expect(result).toBe(true)
      expect(mockErrorResponse).not.toHaveBeenCalled()
    })

    it('should allow OPTIONS requests without CSRF token', async () => {
      mockReq.method = 'OPTIONS'
      
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      
      expect(result).toBe(true)
      expect(mockErrorResponse).not.toHaveBeenCalled()
    })

    it('should reject POST requests without CSRF token', async () => {
      mockReq.method = 'POST'
      mockRedis.get = jest.fn().mockResolvedValue(null)
      
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      
      expect(result).toBe(false)
      expect(mockErrorResponse).toHaveBeenCalledWith(
        mockRes,
        'CSRF token required',
        403,
        'CSRF_REQUIRED'
      )
    })

    it('should reject requests with invalid CSRF token format', async () => {
      mockReq.method = 'POST'
      mockReq.headers = { 'x-csrf-token': 'invalid-token' }
      
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      
      expect(result).toBe(false)
      expect(mockErrorResponse).toHaveBeenCalledWith(
        mockRes,
        'Invalid CSRF token format',
        403,
        'CSRF_INVALID'
      )
    })

    it('should reject requests without authentication', async () => {
      mockReq.method = 'POST'
      mockReq.headers = { 'x-csrf-token': validToken }
      mockGetToken.mockResolvedValue(null)
      
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      
      expect(result).toBe(false)
      expect(mockErrorResponse).toHaveBeenCalledWith(
        mockRes,
        'Authentication required',
        401,
        'AUTH_REQUIRED'
      )
    })

    it('should reject requests with mismatched CSRF token', async () => {
      mockReq.method = 'POST'
      mockReq.headers = { 'x-csrf-token': validToken }
      mockRedis.get = jest.fn().mockResolvedValue('different-token')
      
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      
      expect(result).toBe(false)
      expect(mockErrorResponse).toHaveBeenCalledWith(
        mockRes,
        'CSRF token invalid or expired',
        403,
        'CSRF_INVALID'
      )
    })

    it('should accept requests with valid CSRF token in header', async () => {
      mockReq.method = 'POST'
      mockReq.headers = { 'x-csrf-token': validToken }
      mockRedis.get = jest.fn().mockResolvedValue(validToken)
      
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      
      expect(result).toBe(true)
      expect(mockErrorResponse).not.toHaveBeenCalled()
    })

    it('should accept requests with valid CSRF token in body', async () => {
      mockReq.method = 'POST'
      mockReq.body = { csrfToken: validToken }
      mockRedis.get = jest.fn().mockResolvedValue(validToken)
      
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      
      expect(result).toBe(true)
      expect(mockErrorResponse).not.toHaveBeenCalled()
    })

    it('should prioritize header token over body token', async () => {
      mockReq.method = 'POST'
      mockReq.headers = { 'x-csrf-token': validToken }
      mockReq.body = { csrfToken: 'body-token' }
      
      // Mock Redis to return token for user+session key first
      mockRedis.get = jest.fn()
        .mockResolvedValueOnce(validToken) // First call for user+session key
        .mockResolvedValueOnce(null) // Second call for session-only key (shouldn't be reached)
      
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      
      expect(result).toBe(true)
      expect(mockRedis.get).toHaveBeenCalledWith('csrf:user-456:user-session-123')
      expect(mockRedis.get).toHaveBeenCalledTimes(1) // Should not fall back to session-only
    })

    it('should fall back to session-only key when user+session key not found', async () => {
      mockReq.method = 'POST'
      mockReq.headers = { 'x-csrf-token': validToken }
      
      // Mock Redis to simulate fallback behavior
      mockRedis.get = jest.fn()
        .mockResolvedValueOnce(null) // First call for user+session key returns null
        .mockResolvedValueOnce(validToken) // Second call for session-only key returns token
      
      const result = await validateCSRFToken(mockReq as NextApiRequest, mockRes as NextApiResponse)
      
      expect(result).toBe(true)
      expect(mockRedis.get).toHaveBeenCalledWith('csrf:user-456:user-session-123')
      expect(mockRedis.get).toHaveBeenCalledWith('csrf:user-session-123')
      expect(mockRedis.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('withCSRFProtection', () => {
    it('should call handler with valid CSRF token', async () => {
      const validToken = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      const sessionId = 'user-session-123'
      
      mockReq.method = 'POST'
      mockReq.headers = { 'x-csrf-token': validToken }
      mockGetToken.mockResolvedValue({ id: sessionId })
      mockRedis.get = jest.fn().mockResolvedValue(validToken)
      
      const mockHandler = jest.fn().mockResolvedValue(undefined)
      const wrappedHandler = withCSRFProtection(mockHandler)
      
      await wrappedHandler(mockReq as NextApiRequest, mockRes as NextApiResponse)
      
      expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes)
    })

    it('should not call handler with invalid CSRF token', async () => {
      mockReq.method = 'POST'
      mockGetToken.mockResolvedValue({ id: 'session-id' })
      mockRedis.get = jest.fn().mockResolvedValue(null)
      
      const mockHandler = jest.fn().mockResolvedValue(undefined)
      const wrappedHandler = withCSRFProtection(mockHandler)
      
      await wrappedHandler(mockReq as NextApiRequest, mockRes as NextApiResponse)
      
      expect(mockHandler).not.toHaveBeenCalled()
      expect(mockErrorResponse).toHaveBeenCalledWith(
        mockRes,
        'CSRF token required',
        403,
        'CSRF_REQUIRED'
      )
    })

    it('should pass through handler errors', async () => {
      const validToken = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      const sessionId = 'user-session-123'
      
      mockReq.method = 'POST'
      mockReq.headers = { 'x-csrf-token': validToken }
      mockGetToken.mockResolvedValue({ id: sessionId })
      mockRedis.get = jest.fn().mockResolvedValue(validToken)
      
      const mockHandler = jest.fn().mockRejectedValue(new Error('Handler error'))
      const wrappedHandler = withCSRFProtection(mockHandler)
      
      await expect(wrappedHandler(mockReq as NextApiRequest, mockRes as NextApiResponse))
        .rejects.toThrow('Handler error')
      
      expect(mockHandler).toHaveBeenCalled()
    })
  })
})
