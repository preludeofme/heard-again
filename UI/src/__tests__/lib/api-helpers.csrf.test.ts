import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { apiHandler } from '@/lib/api-helpers'

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>

const SESSION_ID = 'session-id'
const USER_SUB = 'user-sub'

function deriveValidToken(): string {
  return crypto
    .createHmac('sha256', process.env.NEXTAUTH_SECRET as string)
    .update(`${USER_SUB}:${SESSION_ID}`)
    .digest('hex')
}

describe('apiHandler — CSRF default-on', () => {
  beforeEach(() => {
    mockGetToken.mockResolvedValue({ id: SESSION_ID, sub: USER_SUB })
  })

  it('rejects POST without a CSRF token', async () => {
    const handler = apiHandler({
      POST: async (_req, res) => {
        res.status(200).json({ ok: true })
      },
    })
    const req = global.createMockRequest({ method: 'POST', headers: {}, body: {} }) as NextApiRequest
    const res = global.createMockResponse()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('accepts POST with a valid HMAC-derived CSRF token in header', async () => {
    const handler = apiHandler({
      POST: async (_req, res) => {
        res.status(200).json({ ok: true })
      },
    })
    const req = global.createMockRequest({
      method: 'POST',
      headers: { 'x-csrf-token': deriveValidToken() },
      body: {},
    }) as NextApiRequest
    const res = global.createMockResponse()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('allows GET requests without a CSRF token', async () => {
    const handler = apiHandler({
      GET: async (_req, res) => {
        res.status(200).json({ ok: true })
      },
    })
    const req = global.createMockRequest({ method: 'GET', headers: {} }) as NextApiRequest
    const res = global.createMockResponse()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('honors { csrf: false } opt-out for pre-auth POST routes', async () => {
    const handler = apiHandler(
      {
        POST: async (_req, res) => {
          res.status(201).json({ ok: true })
        },
      },
      { csrf: false }
    )
    const req = global.createMockRequest({ method: 'POST', headers: {}, body: {} }) as NextApiRequest
    const res = global.createMockResponse()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('returns 405 for an unsupported method without consulting CSRF', async () => {
    const handler = apiHandler({
      GET: async (_req, res) => {
        res.status(200).json({ ok: true })
      },
    })
    const req = global.createMockRequest({ method: 'DELETE', headers: {} }) as NextApiRequest
    const res = global.createMockResponse()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockGetToken).not.toHaveBeenCalled()
  })
})
