import handler from '@/pages/api/billing/resume'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'

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
    subscription: { findUnique: jest.fn(), update: jest.fn() },
  },
}))

jest.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: { update: jest.fn() },
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

describe('/api/billing/resume', () => {
  const mockUser = { id: 'user-1', familyspaceId: 'fs-1' }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUserWithFamilyspace as jest.Mock).mockResolvedValue(mockUser)
    ;(requireFamilyspaceRole as jest.Mock).mockResolvedValue(undefined)
  })

  it('returns 400 when there is nothing scheduled to cancel', async () => {
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: 'sub_stripe_1',
    })

    const { req, res } = createMocks()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    expect(stripe.subscriptions.update).not.toHaveBeenCalled()
  })

  it('clears cancel_at_period_end on Stripe and locally', async () => {
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      cancelAtPeriodEnd: true,
      stripeSubscriptionId: 'sub_stripe_1',
    })
    ;(prisma.subscription.update as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      billingStatus: 'ACTIVE',
      cancelAtPeriodEnd: false,
    })

    const { req, res } = createMocks()
    await handler(req, res)

    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_stripe_1', { cancel_at_period_end: false })
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData().data.subscription.cancelAtPeriodEnd).toBe(false)
  })
})
