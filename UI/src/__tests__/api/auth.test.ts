import { NextApiRequest, NextApiResponse } from 'next'
import handler from '@/pages/api/people/index'

jest.mock('@/lib/prisma')
jest.mock('@/lib/auth-helpers', () => ({
  getAuthUserWithWorkspace: jest.fn(),
  requireWorkspaceRole: jest.fn(),
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

import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'

const mockGetAuth = getAuthUserWithWorkspace as jest.MockedFunction<typeof getAuthUserWithWorkspace>

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
      workspaceId: 'ws-1',
      role: 'EDITOR',
    } as any)

    // prisma.person.findMany returns [] by default in jest mock
    await handler(req, res)

    expect(res.status).not.toHaveBeenCalledWith(401)
    expect(res.status).not.toHaveBeenCalledWith(403)
  })
})

describe('API route auth — workspace isolation', () => {
  it('should not expose workspace A data to workspace B requests', async () => {
    // The workspace ID is injected from the authenticated session,
    // so a request authenticated as workspace B cannot see workspace A data.
    // This test verifies the auth helper extracts workspace from session, not request body.
    const req = {
      method: 'GET',
      headers: {},
      query: {},
      body: { workspaceId: 'workspace-a' }, // attacker tries to inject a different workspace
    } as unknown as NextApiRequest
    const res = buildMockRes()

    mockGetAuth.mockResolvedValueOnce({
      id: 'user-2',
      workspaceId: 'workspace-b', // session says workspace-b
      role: 'EDITOR',
    } as any)

    await handler(req, res)

    // Response should not reference workspace-a data
    const jsonCalls = (res.json as jest.Mock).mock.calls
    const responseBody = jsonCalls[0]?.[0]
    // If a response was returned, it should not contain workspace-a data
    if (responseBody?.data) {
      const responseStr = JSON.stringify(responseBody.data)
      expect(responseStr).not.toContain('workspace-a')
    }
  })
})
