import handler from '@/pages/api/narration-jobs/[id]'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'

// Manual mock for node-mocks-http
function createMocks({ method = 'GET', query = {}, headers = {} }: any = {}) {
  const req = {
    method,
    query,
    headers,
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

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    voiceGenerationJob: {
      findFirst: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth-helpers', () => ({
  getAuthUserWithFamilyspace: jest.fn(),
  requireFamilyspaceRole: jest.fn(),
}))

jest.mock('@/lib/queues/narrationQueue', () => ({
  getNarrationQueue: jest.fn(() => ({
    getJob: jest.fn(),
  })),
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

describe('/api/narration-jobs/[id] API', () => {
  const mockUser = {
    id: 'user-1',
    familyspaceId: 'ws-1',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUserWithFamilyspace as jest.Mock).mockResolvedValue(mockUser)
  })

  it('should return 404 if job not found', async () => {
    ;(prisma.voiceGenerationJob.findFirst as jest.Mock).mockResolvedValue(null)
    const { req, res } = createMocks({
      method: 'GET',
      query: { id: 'job-1' },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(404)
  })

  it('should return job status from DB', async () => {
    const mockDbJob = {
      id: 'job-1',
      status: 'PROCESSING',
      storyId: 'story-1',
      voiceProfileId: 'voice-1',
      createdAt: new Date(),
    }
    ;(prisma.voiceGenerationJob.findFirst as jest.Mock).mockResolvedValue(mockDbJob)
    
    const { req, res } = createMocks({
      method: 'GET',
      query: { id: 'job-1' },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = res._getJSONData()
    expect(data.success).toBe(true)
    expect(data.status).toBe('processing')
    expect(data.storyId).toBe('story-1')
  })

  it('should include asset details if completed', async () => {
    const mockDbJob = {
      id: 'job-1',
      status: 'COMPLETED',
      storyId: 'story-1',
      outputAssetId: 'asset-1',
      createdAt: new Date(),
    }
    ;(prisma.voiceGenerationJob.findFirst as jest.Mock).mockResolvedValue(mockDbJob)
    
    const { req, res } = createMocks({
      method: 'GET',
      query: { id: 'job-1' },
    })

    await handler(req, res)

    const data = res._getJSONData()
    expect(data.assetId).toBe('asset-1')
    expect(data.assetDownloadUrl).toBe('/api/assets/serve/asset-1')
  })
})
