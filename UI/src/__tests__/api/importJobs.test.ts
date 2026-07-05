import jobHandler from '@/pages/api/import/jobs/[id]'
import tokenHandler from '@/pages/api/import/jobs/[id]/realtime-token'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'

function createMocks({ method = 'GET', query = {}, headers = {}, cookies = {} }: any = {}) {
  const req = {
    method,
    query,
    headers,
    cookies,
  } as any
  const res = {
    _status: 200,
    _headers: {} as any,
    _json: null as any,
    status: function (s: number) {
      this._status = s
      return this
    },
    setHeader: function (k: string, v: string) {
      this._headers[k] = v
      return this
    },
    json: function (j: any) {
      this._json = j
      return this
    },
    _getStatusCode: function () {
      return this._status
    },
    _getJSONData: function () {
      return this._json
    },
  } as any
  return { req, res }
}

jest.mock('@/lib/prisma', () => ({
  prisma: {
    importJob: {
      findUnique: jest.fn(),
    },
    membership: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth-helpers', () => ({
  getAuthUserWithFamilyspace: jest.fn(),
  requireFamilyspaceRole: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

describe('/api/import/jobs/[id] and /realtime-token APIs', () => {
  const mockUser = {
    id: 'user-1',
    familyspaceId: 'ws-1',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUserWithFamilyspace as jest.Mock).mockResolvedValue(mockUser)
  })

  describe('GET /api/import/jobs/[id]', () => {
    it('should return 404 if job not found', async () => {
      ;(prisma.importJob.findUnique as jest.Mock).mockResolvedValue(null)
      const { req, res } = createMocks({
        method: 'GET',
        query: { id: 'job-1' },
      })

      await jobHandler(req, res)
      expect(res._getStatusCode()).toBe(404)
    })

    it('should return 404 if user has no membership in the job workspace and is not the importer', async () => {
      const mockJob = {
        id: 'job-1',
        familyspaceId: 'ws-temp',
        importedById: 'user-other',
        sourceType: 'GEDCOM',
        status: 'PENDING',
      }
      ;(prisma.importJob.findUnique as jest.Mock).mockResolvedValue(mockJob)
      ;(prisma.membership.findUnique as jest.Mock).mockResolvedValue(null)

      const { req, res } = createMocks({
        method: 'GET',
        query: { id: 'job-1' },
      })

      await jobHandler(req, res)
      expect(res._getStatusCode()).toBe(404)
    })

    it('should return 200 if the user is the importer even if they are in a different workspace context', async () => {
      const mockJob = {
        id: 'job-1',
        familyspaceId: 'ws-temp',
        importedById: 'user-1',
        sourceType: 'GEDCOM',
        status: 'PENDING',
        sourceAsset: null,
      }
      ;(prisma.importJob.findUnique as jest.Mock).mockResolvedValue(mockJob)

      const { req, res } = createMocks({
        method: 'GET',
        query: { id: 'job-1' },
      })

      await jobHandler(req, res)
      expect(res._getStatusCode()).toBe(200)
      const result = res._getJSONData()
      expect(result.success).toBe(true)
      expect(result.data.id).toBe('job-1')
      expect(result.data.status).toBe('PENDING')
    })

    it('should return 200 if the user has an active membership in the job workspace', async () => {
      const mockJob = {
        id: 'job-1',
        familyspaceId: 'ws-temp',
        importedById: 'user-other',
        sourceType: 'GEDCOM',
        status: 'COMPLETED',
        sourceAsset: null,
      }
      ;(prisma.importJob.findUnique as jest.Mock).mockResolvedValue(mockJob)
      ;(prisma.membership.findUnique as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        familyspaceId: 'ws-temp',
        status: 'ACTIVE',
      })

      const { req, res } = createMocks({
        method: 'GET',
        query: { id: 'job-1' },
      })

      await jobHandler(req, res)
      expect(res._getStatusCode()).toBe(200)
      const result = res._getJSONData()
      expect(result.success).toBe(true)
      expect(result.data.id).toBe('job-1')
      expect(result.data.status).toBe('COMPLETED')
    })
  })

  describe('GET /api/import/jobs/[id]/realtime-token', () => {
    it('should return 404 if job not found', async () => {
      ;(prisma.importJob.findUnique as jest.Mock).mockResolvedValue(null)
      const { req, res } = createMocks({
        method: 'GET',
        query: { id: 'job-1' },
      })

      await tokenHandler(req, res)
      expect(res._getStatusCode()).toBe(404)
    })

    it('should return 404 if user has no membership and is not the importer', async () => {
      const mockJob = {
        id: 'job-1',
        familyspaceId: 'ws-temp',
        importedById: 'user-other',
        triggerRunId: 'run-1',
      }
      ;(prisma.importJob.findUnique as jest.Mock).mockResolvedValue(mockJob)
      ;(prisma.membership.findUnique as jest.Mock).mockResolvedValue(null)

      const { req, res } = createMocks({
        method: 'GET',
        query: { id: 'job-1' },
      })

      await tokenHandler(req, res)
      expect(res._getStatusCode()).toBe(404)
    })

    it('should return 200 with token if authorized', async () => {
      const mockJob = {
        id: 'job-1',
        familyspaceId: 'ws-temp',
        importedById: 'user-1',
        triggerRunId: 'run-1',
      }
      ;(prisma.importJob.findUnique as jest.Mock).mockResolvedValue(mockJob)

      const { req, res } = createMocks({
        method: 'GET',
        query: { id: 'job-1' },
      })

      await tokenHandler(req, res)
      expect(res._getStatusCode()).toBe(200)
      const result = res._getJSONData()
      expect(result.success).toBe(true)
      expect(result.data.runId).toBe('run-1')
    })
  })
})
