import handler from '@/pages/api/billing/subscribe'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'

function createMocks({ method = 'POST', body = {}, headers = {} }: any = {}) {
  const req = {
    method,
    body,
    headers: { 'x-csrf-token': 'test-token', ...headers },
    cookies: { 'csrf-token': 'test-token' },
  } as any
  const res = {
    _status: 200,
    _json: null as any,
    status: function (s: number) {
      this._status = s
      return this
    },
    setHeader: function () {
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
    plan: { findFirst: jest.fn() },
    subscription: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { create: jest.fn() } },
  },
}))

jest.mock('@/lib/auth-helpers', () => ({
  getAuthUserWithFamilyspace: jest.fn(),
  requireFamilyspaceRole: jest.fn(),
}))

jest.mock('@/lib/security/csrf', () => ({
  validateCSRFToken: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}))

describe('/api/billing/subscribe', () => {
  const mockUser = { id: 'user-1', email: 'user@example.com', familyspaceId: 'fs-1' }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUserWithFamilyspace as jest.Mock).mockResolvedValue(mockUser)
    ;(requireFamilyspaceRole as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null)
  })

  it('returns 404 when the plan does not exist', async () => {
    ;(prisma.plan.findFirst as jest.Mock).mockResolvedValue(null)
    const { req, res } = createMocks({ body: { planId: 'nope', billingCycle: 'monthly' } })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(404)
  })

  it('returns 400 when the plan has no price for the requested billing cycle', async () => {
    ;(prisma.plan.findFirst as jest.Mock).mockResolvedValue({
      id: 'plan-1',
      name: 'Cloud Access — Starter',
      slug: 'cloud_min',
      stripePriceIdMonthly: null,
      stripePriceIdYearly: null,
    })
    const { req, res } = createMocks({ body: { planId: 'cloud_min', billingCycle: 'monthly' } })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
  })

  it('creates a Checkout Session and returns its URL', async () => {
    ;(prisma.plan.findFirst as jest.Mock).mockResolvedValue({
      id: 'plan-1',
      name: 'Cloud Access — Starter',
      slug: 'cloud_min',
      planType: 'CLOUD',
      stripePriceIdMonthly: 'price_123',
      stripePriceIdYearly: null,
    })
    ;(stripe.checkout.sessions.create as jest.Mock).mockResolvedValue({
      url: 'https://checkout.stripe.com/session_abc',
      client_secret: 'cs_abc',
    })

    const { req, res } = createMocks({ body: { planId: 'cloud_min', billingCycle: 'monthly' } })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(201)
    expect(res._getJSONData().data.checkoutUrl).toBe('https://checkout.stripe.com/session_abc')

    const createArgs = (stripe.checkout.sessions.create as jest.Mock).mock.calls[0][0]
    expect(createArgs.mode).toBe('subscription')
    expect(createArgs.line_items).toEqual([{ price: 'price_123', quantity: 1 }])
    expect(createArgs).not.toHaveProperty('payment_method_types')
  })

  it('reuses the existing Stripe customer id when one is on file', async () => {
    ;(prisma.plan.findFirst as jest.Mock).mockResolvedValue({
      id: 'plan-1',
      name: 'Cloud Access — Starter',
      slug: 'cloud_min',
      planType: 'CLOUD',
      stripePriceIdMonthly: 'price_123',
      stripePriceIdYearly: null,
    })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      stripeCustomerId: 'cus_existing',
    })
    ;(stripe.checkout.sessions.create as jest.Mock).mockResolvedValue({ url: 'https://checkout.stripe.com/x', client_secret: 'cs_x' })

    const { req, res } = createMocks({ body: { planId: 'cloud_min', billingCycle: 'monthly' } })
    await handler(req, res)

    const createArgs = (stripe.checkout.sessions.create as jest.Mock).mock.calls[0][0]
    expect(createArgs.customer).toBe('cus_existing')
    expect(createArgs.customer_email).toBeUndefined()
  })
})
