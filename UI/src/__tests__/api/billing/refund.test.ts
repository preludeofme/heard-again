import handler from '@/pages/api/billing/refund'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { Errors } from '@/lib/api-helpers'

function createMocks({ method = 'POST', body = {} }: any = {}) {
  const req = {
    method,
    body,
    headers: { 'x-csrf-token': 'test-token' },
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
    subscription: { findUnique: jest.fn() },
    refund: { create: jest.fn(), findMany: jest.fn() },
  },
}))

jest.mock('@/lib/stripe', () => ({
  stripe: {
    invoices: { list: jest.fn() },
    refunds: { create: jest.fn() },
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

describe('/api/billing/refund', () => {
  const mockUser = { id: 'user-1', familyspaceId: 'fs-1' }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUserWithFamilyspace as jest.Mock).mockResolvedValue(mockUser)
    ;(requireFamilyspaceRole as jest.Mock).mockResolvedValue(undefined)
  })

  it('is gated to OWNER/ADMIN via requireFamilyspaceRole("ADMIN")', async () => {
    ;(requireFamilyspaceRole as jest.Mock).mockRejectedValue(Errors.forbidden('Not authorized'))

    const { req, res } = createMocks()
    await handler(req, res)

    expect(requireFamilyspaceRole).toHaveBeenCalledWith('user-1', 'fs-1', 'ADMIN')
    expect(res._getStatusCode()).toBe(403)
  })

  it('uses the cached payment intent when available and creates a refund', async () => {
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      stripeSubscriptionId: 'sub_stripe_1',
      stripeLatestPaymentIntentId: 'pi_cached',
    })
    ;(stripe.refunds.create as jest.Mock).mockResolvedValue({
      id: 're_123',
      amount: 999,
      currency: 'usd',
      status: 'succeeded',
    })
    ;(prisma.refund.create as jest.Mock).mockResolvedValue({
      id: 'refund-1',
      amountCents: 999,
      currency: 'usd',
      status: 'SUCCEEDED',
      createdAt: new Date(),
    })

    const { req, res } = createMocks({ body: {} })
    await handler(req, res)

    expect(stripe.invoices.list).not.toHaveBeenCalled()
    expect(stripe.refunds.create).toHaveBeenCalledWith({
      payment_intent: 'pi_cached',
      reason: 'requested_by_customer',
    })
    expect(res._getStatusCode()).toBe(201)
  })

  it('falls back to looking up the latest paid invoice when no payment intent is cached', async () => {
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      stripeSubscriptionId: 'sub_stripe_1',
      stripeLatestPaymentIntentId: null,
    })
    ;(stripe.invoices.list as jest.Mock).mockResolvedValue({
      data: [{ payments: { data: [{ payment: { payment_intent: 'pi_fallback' } }] } }],
    })
    ;(stripe.refunds.create as jest.Mock).mockResolvedValue({
      id: 're_456',
      amount: 500,
      currency: 'usd',
      status: 'pending',
    })
    ;(prisma.refund.create as jest.Mock).mockResolvedValue({
      id: 'refund-2',
      amountCents: 500,
      currency: 'usd',
      status: 'PENDING',
      createdAt: new Date(),
    })

    const { req, res } = createMocks({ body: { amountCents: 500 } })
    await handler(req, res)

    expect(stripe.refunds.create).toHaveBeenCalledWith({
      payment_intent: 'pi_fallback',
      amount: 500,
      reason: 'requested_by_customer',
    })
    expect(res._getStatusCode()).toBe(201)
  })

  it('returns 400 when no payment can be found to refund', async () => {
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      stripeSubscriptionId: 'sub_stripe_1',
      stripeLatestPaymentIntentId: null,
    })
    ;(stripe.invoices.list as jest.Mock).mockResolvedValue({ data: [] })

    const { req, res } = createMocks()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    expect(stripe.refunds.create).not.toHaveBeenCalled()
  })
})
