import handler from '@/pages/api/billing/webhook'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/logger'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: { updateMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
    plan: { findUnique: jest.fn() },
    familyspace: { update: jest.fn() },
    refund: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}))

jest.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: jest.fn() },
    invoices: { retrieve: jest.fn() },
    subscriptions: { retrieve: jest.fn(), cancel: jest.fn() },
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}))

jest.mock('@/server/services/billing-reconcile', () => ({
  downgradeFamilyspaceToFreePlan: jest.fn(),
}))

function createMocks() {
  const req = {
    method: 'POST',
    headers: { 'stripe-signature': 'sig' },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from('{}')
    },
  } as any
  const res = {
    _status: 200,
    _json: null as any,
    status(s: number) {
      this._status = s
      return this
    },
    setHeader() {
      return this
    },
    json(j: any) {
      this._json = j
      return this
    },
    _getStatusCode() {
      return this._status
    },
    _getJSONData() {
      return this._json
    },
  } as any
  return { req, res }
}

function givenEvent(event: unknown) {
  ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(event)
}

describe('/api/billing/webhook invoice events', () => {
  const PERIOD_END = 1792000000

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    ;(stripe.invoices.retrieve as jest.Mock).mockResolvedValue({
      payments: { data: [{ payment: { payment_intent: 'pi_123' } }] },
    })
    ;(stripe.subscriptions.retrieve as jest.Mock).mockResolvedValue({
      items: { data: [{ current_period_end: PERIOD_END }] },
    })
    ;(prisma.subscription.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
  })

  it('should extend the subscription when invoice.paid uses the legacy top-level subscription field', async () => {
    givenEvent({
      type: 'invoice.paid',
      data: { object: { id: 'in_1', subscription: 'sub_legacy' } },
    })

    const { req, res } = createMocks()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_legacy' },
      data: expect.objectContaining({
        billingStatus: 'ACTIVE',
        renewalDate: new Date(PERIOD_END * 1000),
        stripeLatestPaymentIntentId: 'pi_123',
        generationMinutesUsed: 0,
      }),
    })
  })

  it('should extend the subscription when invoice.paid uses the parent.subscription_details shape', async () => {
    givenEvent({
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_2',
          parent: { subscription_details: { subscription: 'sub_dahlia' } },
        },
      },
    })

    const { req, res } = createMocks()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_dahlia' },
      data: expect.objectContaining({ billingStatus: 'ACTIVE' }),
    })
  })

  it('should resolve an expanded subscription object on the invoice parent', async () => {
    givenEvent({
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_3',
          parent: { subscription_details: { subscription: { id: 'sub_expanded' } } },
        },
      },
    })

    const { req, res } = createMocks()
    await handler(req, res)

    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_expanded' },
      data: expect.objectContaining({ billingStatus: 'ACTIVE' }),
    })
  })

  it('should warn and skip when invoice.paid carries no subscription id', async () => {
    givenEvent({ type: 'invoice.paid', data: { object: { id: 'in_4' } } })

    const { req, res } = createMocks()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('in_4'))
  })

  it('should mark past due when invoice.payment_failed uses the parent.subscription_details shape', async () => {
    givenEvent({
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_5',
          parent: { subscription_details: { subscription: 'sub_dahlia' } },
        },
      },
    })

    const { req, res } = createMocks()
    await handler(req, res)

    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_dahlia' },
      data: { billingStatus: 'PAST_DUE' },
    })
  })

  it('should warn and skip when invoice.payment_failed carries no subscription id', async () => {
    givenEvent({ type: 'invoice.payment_failed', data: { object: { id: 'in_6' } } })

    const { req, res } = createMocks()
    await handler(req, res)

    expect(prisma.subscription.updateMany).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('in_6'))
  })
})
