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
    plan: { findFirst: jest.fn() },
    familyspace: { update: jest.fn() },
  },
}))

jest.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: { update: jest.fn(), retrieve: jest.fn() },
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
    ;(stripe.subscriptions.retrieve as jest.Mock).mockResolvedValue({ status: 'active' })
    ;(prisma.subscription.update as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      billingStatus: 'ACTIVE',
      cancelAtPeriodEnd: false,
    })

    const { req, res } = createMocks()
    await handler(req, res)

    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_stripe_1')
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_stripe_1', { cancel_at_period_end: false })
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData().data.subscription.cancelAtPeriodEnd).toBe(false)
  })

  it('self-heals and returns 400 when Stripe already fully canceled the subscription', async () => {
    // Simulates a stale local row: our webhook for `customer.subscription.deleted`
    // hasn't landed yet (delayed/failed delivery), so `cancelAtPeriodEnd` is still
    // true locally even though Stripe's live status is already terminal.
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      familyspaceId: 'fs-1',
      cancelAtPeriodEnd: true,
      stripeSubscriptionId: 'sub_stripe_1',
    })
    ;(stripe.subscriptions.retrieve as jest.Mock).mockResolvedValue({ status: 'canceled' })
    ;(prisma.plan.findFirst as jest.Mock).mockResolvedValue({ id: 'plan-free' })

    const { req, res } = createMocks()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    expect(res._getJSONData().error).toMatch(/already ended/i)
    expect(stripe.subscriptions.update).not.toHaveBeenCalled()
    // Reconciled locally so this doesn't happen again for the same subscription.
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1' },
        data: expect.objectContaining({ stripeSubscriptionId: null, cancelAtPeriodEnd: false }),
      })
    )
    expect(prisma.familyspace.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'fs-1' } })
    )
  })

  it('self-heals and returns 400 when Stripe has no record of the subscription at all', async () => {
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      familyspaceId: 'fs-1',
      cancelAtPeriodEnd: true,
      stripeSubscriptionId: 'sub_stripe_1',
    })
    ;(stripe.subscriptions.retrieve as jest.Mock).mockRejectedValue(new Error('No such subscription'))
    ;(prisma.plan.findFirst as jest.Mock).mockResolvedValue({ id: 'plan-free' })

    const { req, res } = createMocks()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    expect(res._getJSONData().error).toMatch(/already ended/i)
    expect(stripe.subscriptions.update).not.toHaveBeenCalled()
  })
})
