import { NextApiRequest, NextApiResponse } from 'next'

declare global {
  // eslint-disable-next-line no-var
  var createMockRequest: (overrides?: Partial<NextApiRequest>) => Partial<NextApiRequest>
  // eslint-disable-next-line no-var
  var createMockResponse: () => NextApiResponse
}

// Mock NextAuth for testing
jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}))

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}))

// Mock Redis for testing
jest.mock('@/lib/redis-client', () => ({
  redis: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  },
  rateLimitCheck: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 100,
    resetAt: new Date(),
  }),
}))

// Mock Prisma for testing
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    familyspace: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    person: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    story: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    voiceProfile: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    asset: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    document: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    documentPerson: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    membership: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  },
}))

// Mock Trigger.dev SDK
jest.mock('@trigger.dev/sdk/v3', () => {
  const mockTask = (options: any) => {
    return {
      id: options.id,
      trigger: jest.fn().mockResolvedValue({ id: 'mock-run-id' }),
      triggerAndWait: jest.fn().mockResolvedValue({ ok: true, output: {} }),
      batchTrigger: jest.fn().mockResolvedValue([]),
    }
  }
  return {
    task: mockTask,
    metadata: {
      set: jest.fn(),
      get: jest.fn(),
      increment: jest.fn(),
      append: jest.fn(),
    },
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn((name, fn) => fn({ setAttribute: jest.fn() })),
    },
    runs: {
      retrieve: jest.fn().mockResolvedValue({ id: 'mock-run-id', status: 'COMPLETED' }),
    },
    auth: {
      createPublicToken: jest.fn().mockResolvedValue('mock-public-token'),
    },
  }
})


// Global test utilities
global.createMockRequest = (overrides: Partial<NextApiRequest> = {}) => ({
  method: 'POST',
  headers: {},
  body: {},
  query: {},
  ...overrides,
})

global.createMockResponse = () => {
  const res: Partial<NextApiResponse> = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  res.setHeader = jest.fn().mockReturnValue(res)
  return res as NextApiResponse
}

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks()
})
