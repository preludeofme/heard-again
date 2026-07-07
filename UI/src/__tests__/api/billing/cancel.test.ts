import handler from '@/pages/api/billing/cancel'
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
    plan: { findFirst: jest.fn() },
    familyspace: { update: jest.fn() },
  },
}))

jest.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: { cancel: jest.fn(), update: jest.fn() },
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

describe('/api/billing/cancel', () => {
  const mockUser = { id: 'user-1', familyspaceId: 'fs-1' }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUserWithFamilyspace as jest.Mock).mockResolvedValue(mockUser)
    ;(requireFamilyspaceRole as jest.Mock).mockResolvedValue(undefined)
  })

  it('returns 400 for a FREE plan', async () => {
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      billingStatus: 'ACTIVE',
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: 'sub_stripe_1',
      plan: { planType: 'FREE' },
    })

    const { req, res } = createMocks()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    expect(stripe.subscriptions.update).not.toHaveBeenCalled()
  })

  it('schedules cancel_at_period_end by default (does not downgrade immediately)', async () => {
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      billingStatus: 'ACTIVE',
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: 'sub_stripe_1',
      plan: { planType: 'CLOUD' },
    })
    ;(prisma.subscription.update as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      billingStatus: 'ACTIVE',
      cancelAtPeriodEnd: true,
      renewalDate: new Date('2026-08-01'),
    })

    const { req, res } = createMocks()
    await handler(req, res)

    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_stripe_1', { cancel_at_period_end: true })
    expect(prisma.familyspace.update).not.toHaveBeenCalled()
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData().data.subscription.cancelAtPeriodEnd).toBe(true)
  })

  it('cancels immediately and downgrades to FREE when immediate: true', async () => {
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      billingStatus: 'ACTIVE',
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: 'sub_stripe_1',
      plan: { planType: 'CLOUD' },
    })
    ;(prisma.plan.findFirst as jest.Mock).mockResolvedValue({ id: 'free-plan', planType: 'FREE' })
    ;(prisma.subscription.update as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      billingStatus: 'ACTIVE',
      cancelledAt: new Date(),
    })

    const { req, res } = createMocks({ body: { immediate: true } })
    await handler(req, res)

    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_stripe_1')
    expect(prisma.familyspace.update).toHaveBeenCalled()
    expect(res._getStatusCode()).toBe(200)
  })

  it('returns 400 when already scheduled to cancel', async () => {
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      billingStatus: 'ACTIVE',
      cancelAtPeriodEnd: true,
      stripeSubscriptionId: 'sub_stripe_1',
      plan: { planType: 'CLOUD' },
    })

    const { req, res } = createMocks()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
  })
})
