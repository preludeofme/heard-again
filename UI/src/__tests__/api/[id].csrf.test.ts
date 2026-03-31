import { NextApiRequest, NextApiResponse } from 'next'
import handler from '@/pages/api/people/[id]'

// Mock dependencies
jest.mock('@/lib/prisma')
jest.mock('@/lib/auth-helpers')
jest.mock('@/lib/api-helpers')

describe('API CSRF Protection Integration', () => {
  let mockReq: Partial<NextApiRequest>
  let mockRes: Partial<NextApiResponse>

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockReq = {
      method: 'PUT',
      query: { id: 'person-123' },
      headers: {},
      body: {
        firstName: 'John',
        lastName: 'Doe',
      },
    }
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    }
  })

  describe('PUT /api/people/[id]', () => {
    it('should reject requests without CSRF token', async () => {
      // Mock authentication but no CSRF token
      const { getAuthUserWithWorkspace } = require('@/lib/auth-helpers')
      getAuthUserWithWorkspace.mockResolvedValue({
        id: 'user-123',
        workspaceId: 'workspace-123',
      })

      await handler(mockReq as NextApiRequest, mockRes as NextApiResponse)

      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'CSRF token required',
        })
      )
    })

    it('should reject requests with invalid CSRF token format', async () => {
      mockReq.headers = { 'x-csrf-token': 'invalid-token' }

      const { getAuthUserWithWorkspace } = require('@/lib/auth-helpers')
      getAuthUserWithWorkspace.mockResolvedValue({
        id: 'user-123',
        workspaceId: 'workspace-123',
      })

      await handler(mockReq as NextApiRequest, mockRes as NextApiResponse)

      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid CSRF token format',
        })
      )
    })

    it('should allow requests with valid CSRF token', async () => {
      const validToken = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      mockReq.headers = { 'x-csrf-token': validToken }

      // Mock authentication
      const { getAuthUserWithWorkspace, requireWorkspaceRole } = require('@/lib/auth-helpers')
      getAuthUserWithWorkspace.mockResolvedValue({
        id: 'user-123',
        workspaceId: 'workspace-123',
      })
      requireWorkspaceRole.mockResolvedValue(undefined)

      // Mock CSRF validation
      const { redis } = require('@/lib/redis-client')
      redis.get.mockResolvedValue(validToken)

      // Mock successful person update
      const { prisma } = require('@/lib/prisma')
      prisma.person.findFirst.mockResolvedValue({
        id: 'person-123',
        firstName: 'Jane',
        lastName: 'Smith',
      })
      prisma.person.update.mockResolvedValue({
        id: 'person-123',
        firstName: 'John',
        lastName: 'Doe',
        updatedAt: new Date(),
      })

      // Mock success response
      const { successResponse } = require('@/lib/api-helpers')
      successResponse.mockImplementation((res, data) => {
        res.status(200).json({ success: true, data })
        return res
      })

      await handler(mockReq as NextApiRequest, mockRes as NextApiResponse)

      expect(redis.get).toHaveBeenCalledWith('csrf:user-123')
      expect(prisma.person.update).toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(200)
    })
  })

  describe('DELETE /api/people/[id]', () => {
    beforeEach(() => {
      mockReq.method = 'DELETE'
    })

    it('should reject delete requests without CSRF token', async () => {
      const { getAuthUserWithWorkspace } = require('@/lib/auth-helpers')
      getAuthUserWithWorkspace.mockResolvedValue({
        id: 'user-123',
        workspaceId: 'workspace-123',
      })

      await handler(mockReq as NextApiRequest, mockRes as NextApiResponse)

      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'CSRF token required',
        })
      )
    })

    it('should allow delete requests with valid CSRF token', async () => {
      const validToken = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      mockReq.headers = { 'x-csrf-token': validToken }

      // Mock authentication
      const { getAuthUserWithWorkspace, requireWorkspaceRole } = require('@/lib/auth-helpers')
      getAuthUserWithWorkspace.mockResolvedValue({
        id: 'user-123',
        workspaceId: 'workspace-123',
      })
      requireWorkspaceRole.mockResolvedValue(undefined)

      // Mock CSRF validation
      const { redis } = require('@/lib/redis-client')
      redis.get.mockResolvedValue(validToken)

      // Mock successful person deletion
      const { prisma } = require('@/lib/prisma')
      prisma.person.findFirst.mockResolvedValue({
        id: 'person-123',
        firstName: 'John',
        lastName: 'Doe',
      })
      prisma.person.delete.mockResolvedValue(undefined)

      // Mock success response
      const { successResponse } = require('@/lib/api-helpers')
      successResponse.mockImplementation((res, data) => {
        res.status(200).json({ success: true, data })
        return res
      })

      await handler(mockReq as NextApiRequest, mockRes as NextApiResponse)

      expect(redis.get).toHaveBeenCalledWith('csrf:user-123')
      expect(prisma.person.delete).toHaveBeenCalledWith({
        where: { id: 'person-123' },
      })
      expect(mockRes.status).toHaveBeenCalledWith(200)
    })
  })

  describe('GET /api/people/[id]', () => {
    beforeEach(() => {
      mockReq.method = 'GET'
    })

    it('should allow GET requests without CSRF token', async () => {
      // Mock authentication
      const { getAuthUserWithWorkspace } = require('@/lib/auth-helpers')
      getAuthUserWithWorkspace.mockResolvedValue({
        id: 'user-123',
        workspaceId: 'workspace-123',
      })

      // Mock successful person retrieval
      const { prisma } = require('@/lib/prisma')
      prisma.person.findFirst.mockResolvedValue({
        id: 'person-123',
        firstName: 'John',
        lastName: 'Doe',
      })

      // Mock success response
      const { successResponse } = require('@/lib/api-helpers')
      successResponse.mockImplementation((res, data) => {
        res.status(200).json({ success: true, data })
        return res
      })

      await handler(mockReq as NextApiRequest, mockRes as NextApiResponse)

      expect(redis.get).not.toHaveBeenCalled()
      expect(prisma.person.findFirst).toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(200)
    })
  })
})
