import handler from '@/pages/api/stories/[id]/narrate'
import { prisma } from '@/lib/prisma'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { narrationTask } from '@/trigger/narration-task'

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
    _redirect: null as any,
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
    redirect: function (s: number, u: string) {
      this._status = s
      this._redirect = u
      return this
    },
    _getStatusCode: function () {
      return this._status
    },
    _getJSONData: function () {
      return this._json
    },
    _getRedirectUrl: function () {
      return this._redirect
    },
  } as any
  return { req, res }
}

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    story: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    voiceProfile: {
      findFirst: jest.fn(),
    },
    voiceConsent: {
      findFirst: jest.fn(),
    },
    voiceGenerationJob: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    asset: {
      findFirst: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn().mockResolvedValue({
        generationMinutesUsed: 5,
        plan: {
          planType: 'PRO',
          generationMinutesIncluded: 100,
        },
      }),
    },
  },
}))

jest.mock('@/lib/auth-helpers', () => ({
  getAuthUserWithFamilyspace: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}))

describe('/api/stories/[id]/narrate API', () => {
  const mockUser = {
    id: 'user-1',
    familyspaceId: 'ws-1',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.AUDIO_GENERATION_ENABLED = 'true'
    ;(getAuthUserWithFamilyspace as jest.Mock).mockResolvedValue(mockUser)
  })

  it('should return 405 for non-GET methods', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'story-1' },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(405)
  })

  it('should return 503 if audio generation is disabled', async () => {
    process.env.AUDIO_GENERATION_ENABLED = 'false'
    const { req, res } = createMocks({
      method: 'GET',
      query: { id: 'story-1' },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(503)
  })

  it('should redirect if cached asset exists', async () => {
    ;(prisma.story.findFirst as jest.Mock).mockResolvedValue({
      id: 'story-1',
      content: 'Some text',
      narrationStatus: 'APPROVED',
      narratedContent: 'Approved text',
    })
    ;(prisma.asset.findFirst as jest.Mock).mockResolvedValue({
      id: 'asset-1',
    })

    const { req, res } = createMocks({
      method: 'GET',
      query: { id: 'story-1', voiceProfileId: 'voice-1' },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(302)
    expect(res._getRedirectUrl()).toBe('/api/assets/serve/asset-1')
  })

  it('should return JSON if cached asset exists and client wants JSON', async () => {
    ;(prisma.story.findFirst as jest.Mock).mockResolvedValue({
      id: 'story-1',
      content: 'Some text',
    })
    ;(prisma.asset.findFirst as jest.Mock).mockResolvedValue({
      id: 'asset-1',
    })

    const { req, res } = createMocks({
      method: 'GET',
      query: { id: 'story-1', voiceProfileId: 'voice-1' },
      headers: { accept: 'application/json' },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = res._getJSONData()
    expect(data.success).toBe(true)
    expect(data.status).toBe('ready')
    expect(data.assetId).toBe('asset-1')
  })

  it('should enqueue a job if no cache hit', async () => {
    ;(prisma.story.findFirst as jest.Mock).mockResolvedValue({
      id: 'story-1',
      content: 'Some text',
    })
    ;(prisma.asset.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.voiceProfile.findFirst as jest.Mock).mockResolvedValue({
      id: 'voice-1',
      status: 'READY',
    })
    ;(prisma.voiceGenerationJob.create as jest.Mock).mockResolvedValue({
      id: 'vjob-1',
    })

    const { req, res } = createMocks({
      method: 'GET',
      query: { id: 'story-1', voiceProfileId: 'voice-1' },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(202)
    const data = res._getJSONData()
    expect(data.status).toBe('queued')
    expect(data.narrationJobId).toBe('vjob-1')
    expect(narrationTask.trigger).toHaveBeenCalled()
    expect(prisma.story.update).toHaveBeenCalledWith({
      where: { id: 'story-1' },
      data: { narrationRenderJobId: 'vjob-1' },
    })
  })
})
