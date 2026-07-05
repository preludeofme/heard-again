import crypto from 'crypto'
import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const SESSION_ID = 'test-session-id'
const USER_SUB = 'test-user-sub'

export const TEST_SESSION = { id: SESSION_ID, sub: USER_SUB } as const

export function deriveValidCSRFToken(): string {
  return crypto
    .createHmac('sha256', process.env.NEXTAUTH_SECRET as string)
    .update(`${USER_SUB}:${SESSION_ID}`)
    .digest('hex')
}

export interface MockReqOptions {
  method: string
  query?: Record<string, string | string[]>
  body?: any
  csrfToken?: string | null
}

export function buildReq({ method, query = {}, body = {}, csrfToken }: MockReqOptions): NextApiRequest {
  const headers: Record<string, string> = {}
  if (csrfToken) headers['x-csrf-token'] = csrfToken
  return {
    method: method.toUpperCase(),
    headers,
    query,
    body,
    cookies: {},
    url: '/api/test',
  } as unknown as NextApiRequest
}

export function buildRes(): NextApiResponse & {
  _status: number | undefined
  _body: unknown
} {
  let statusCode: number | undefined
  let body: unknown
  const res = {
    _status: undefined as number | undefined,
    _body: undefined as unknown,
    status: jest.fn(function (this: any, code: number) {
      statusCode = code
      return this
    }),
    json: jest.fn(function (this: any, payload: unknown) {
      body = payload
      return this
    }),
    setHeader: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    send: jest.fn(function (this: any, payload: unknown) {
      body = payload
      return this
    }),
  } as any
  Object.defineProperty(res, '_status', { get: () => statusCode })
  Object.defineProperty(res, '_body', { get: () => body })
  return res as NextApiResponse & { _status: number | undefined; _body: unknown }
}

export interface ContractRouteSpec {
  /** Display name in test output, e.g. "POST /api/people" */
  label: string
  /** The route's default-exported handler */
  handler: NextApiHandler
  /** All HTTP methods the route officially supports */
  supportedMethods: Array<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>
  /** A method *not* in supportedMethods, used to verify 405 */
  unsupportedMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Optional: required query params (e.g. `{ id: 'p1' }` for /api/people/[id]) */
  query?: Record<string, string>
  /**
   * Routes that bypass apiHandler's CSRF default (e.g. signup, webhooks, formidable uploads)
   * cannot be exercised through the unified contract — the test will be skipped.
   */
  csrfDefaultOn?: boolean
  /** Methods that do not require authentication */
  unauthAllowedMethods?: Array<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>
}

/**
 * Run the standard auth/CSRF/method contract assertions against a route.
 * - 405 when called with an unsupported method
 * - 403 when a state-changing method has no CSRF token
 * - 401 when a safe method has no authenticated session
 *
 * Caller is responsible for setting up mocks for `next-auth/jwt` (`getToken`)
 * before invoking this — see contract.test.ts for the canonical setup.
 */
export async function assertContract(
  spec: ContractRouteSpec,
  hooks: {
    /** Configure auth helpers / Prisma to return "no session" for the unauth case */
    setUnauthenticated: () => void;
    /** Configure auth helpers to return a valid session */
    setAuthenticated: () => void;
  }
): Promise<void> {
  const stateChangingMethods = spec.supportedMethods.filter((m) => !SAFE_METHODS.has(m))
  const safeMethods = spec.supportedMethods.filter((m) => SAFE_METHODS.has(m))

  // 1. Unsupported method → 405
  {
    hooks.setAuthenticated() // Use authenticated session for method check
    const req = buildReq({ method: spec.unsupportedMethod, query: spec.query })
    const res = buildRes()
    await spec.handler(req, res)
    expect({ label: spec.label, scenario: 'unsupported method', status: res._status }).toEqual({
      label: spec.label,
      scenario: 'unsupported method',
      status: 405,
    })
  }

  // 2. State-changing method without CSRF token → 403
  for (const method of stateChangingMethods) {
    if (spec.csrfDefaultOn === false) continue // route opts out
    hooks.setAuthenticated() // Use authenticated session to test CSRF specifically
    const req = buildReq({ method, query: spec.query })
    const res = buildRes()
    await spec.handler(req, res)
    expect({ label: spec.label, method, scenario: 'no CSRF', status: res._status }).toEqual({
      label: spec.label,
      method,
      scenario: 'no CSRF',
      status: 403,
    })
  }

  // 3. Safe method without auth → 401
  for (const method of safeMethods) {
    if (spec.unauthAllowedMethods?.includes(method)) continue
    hooks.setUnauthenticated()
    const req = buildReq({ method, query: spec.query })
    const res = buildRes()
    await spec.handler(req, res)
    expect({ label: spec.label, method, scenario: 'no auth', status: res._status }).toEqual({
      label: spec.label,
      method,
      scenario: 'no auth',
      status: 401,
    })
  }
}
