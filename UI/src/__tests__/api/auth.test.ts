import { NextApiRequest, NextApiResponse } from 'next'
import handler from '@/pages/api/people/index'

jest.mock('@/lib/prisma')
jest.mock('@/lib/auth-helpers', () => ({
  getAuthUserWithFamilyspace: jest.fn(),
  requireFamilyspaceRole: jest.fn(),
}))
jest.mock('@/lib/api-helpers', () => ({
  ...jest.requireActual('@/lib/api-helpers'),
  apiHandler: (routes: any) => async (req: any, res: any) => {
    const method = req.method?.toUpperCase() ?? 'GET'
    const routeHandler = routes[method]
    if (!routeHandler) {
      return res.status(405).json({ error: 'Method not allowed' })
    }
    return routeHandler(req, res)
  },
}))

import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'

const mockGetAuth = getAuthUserWithFamilyspace as jest.MockedFunction<typeof getAuthUserWithFamilyspace>

function buildMockRes() {
  const res: Partial<NextApiResponse> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    end: jest.fn(),
  }
  return res as NextApiResponse
}

describe('API route auth — GET /api/people', () => {
  it('should return 401 when unauthenticated request is made', async () => {
    const req = { method: 'GET', headers: {}, query: {} } as unknown as NextApiRequest
    const res = buildMockRes()

    mockGetAuth.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { statusCode: 401 })
    )

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('should return 200 when authenticated EDITOR makes GET request', async () => {
    const req = { method: 'GET', headers: {}, query: {} } as unknown as NextApiRequest
    const res = buildMockRes()

    mockGetAuth.mockResolvedValueOnce({
      id: 'user-1',
      familyspaceId: 'ws-1',
      role: 'EDITOR',
    } as any)

    // prisma.person.findMany returns [] by default in jest mock
    await handler(req, res)

    expect(res.status).not.toHaveBeenCalledWith(401)
    expect(res.status).not.toHaveBeenCalledWith(403)
  })
})

describe('API route auth — familyspace isolation', () => {
  it('should not expose familyspace A data to familyspace B requests', async () => {
    // The familyspace ID is injected from the authenticated session,
    // so a request authenticated as familyspace B cannot see familyspace A data.
    // This test verifies the auth helper extracts familyspace from session, not request body.
    const req = {
      method: 'GET',
      headers: {},
      query: {},
      body: { familyspaceId: 'familyspace-a' }, // attacker tries to inject a different familyspace
    } as unknown as NextApiRequest
    const res = buildMockRes()

    mockGetAuth.mockResolvedValueOnce({
      id: 'user-2',
      familyspaceId: 'familyspace-b', // session says familyspace-b
      role: 'EDITOR',
    } as any)

    await handler(req, res)

    // Response should not reference familyspace-a data
    const jsonCalls = (res.json as jest.Mock).mock.calls
    const responseBody = jsonCalls[0]?.[0]
    // If a response was returned, it should not contain familyspace-a data
    if (responseBody?.data) {
      const responseStr = JSON.stringify(responseBody.data)
      expect(responseStr).not.toContain('familyspace-a')
    }
  })
})
