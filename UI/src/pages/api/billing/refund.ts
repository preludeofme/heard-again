import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'
import { withRateLimit } from '@/lib/security/rate-limiter'

const STRIPE_REFUND_REASONS = ['duplicate', 'fraudulent', 'requested_by_customer'] as const
type StripeRefundReason = (typeof STRIPE_REFUND_REASONS)[number]

const handler = apiHandler({
  // POST /api/billing/refund - Issue a refund against the subscription's latest payment
  // Owner/admin only. Body: { amountCents?: number (partial refund; omit for full), reason?: string }
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'ADMIN')

    const { valid, errors } = validate(req.body, {
      amountCents: [rules.number],
      reason: [rules.string],
    })

    if (!valid) {
      throw Errors.badRequest('Validation failed', errors)
    }

    const { amountCents, reason } = req.body as { amountCents?: number; reason?: string }

    if (amountCents != null && amountCents <= 0) {
      throw Errors.badRequest('amountCents must be a positive number')
    }

    const subscription = await prisma.subscription.findUnique({
      where: { familyspaceId: user.familyspaceId },
    })

    if (!subscription) {
      throw Errors.notFound('Subscription')
    }

    let paymentIntentId: string | null | undefined = subscription.stripeLatestPaymentIntentId

    // Fall back to Stripe if we haven't captured a payment intent locally yet
    // (e.g. subscription predates this field, or the invoice.paid webhook hasn't landed).
    if (!paymentIntentId && subscription.stripeSubscriptionId) {
      const invoices = await stripe.invoices.list({
        subscription: subscription.stripeSubscriptionId,
        status: 'paid',
        limit: 1,
        expand: ['data.payments.data.payment.payment_intent'],
      })
      const pi = invoices.data[0]?.payments?.data?.[0]?.payment?.payment_intent
      paymentIntentId = typeof pi === 'string' ? pi : pi?.id
    }

    if (!paymentIntentId) {
      throw Errors.badRequest('No payment found for this subscription to refund')
    }

    const stripeReason: StripeRefundReason = STRIPE_REFUND_REASONS.includes(reason as StripeRefundReason)
      ? (reason as StripeRefundReason)
      : 'requested_by_customer'

    const stripeRefund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(amountCents ? { amount: amountCents } : {}),
      reason: stripeReason,
    })

    const refund = await prisma.refund.create({
      data: {
        subscriptionId: subscription.id,
        familyspaceId: user.familyspaceId,
        requestedById: user.id,
        amountCents: stripeRefund.amount,
        currency: stripeRefund.currency,
        reason: reason || null,
        status: stripeRefund.status === 'succeeded'
          ? 'SUCCEEDED'
          : stripeRefund.status === 'failed'
            ? 'FAILED'
            : stripeRefund.status === 'canceled'
              ? 'CANCELED'
              : 'PENDING',
        stripeRefundId: stripeRefund.id,
        stripePaymentIntentId: paymentIntentId,
      },
    })

    return successResponse(res, {
      refund: {
        id: refund.id,
        amountCents: refund.amountCents,
        currency: refund.currency,
        status: refund.status,
        createdAt: refund.createdAt,
      },
      message: 'Refund submitted successfully.',
    }, 201)
  },

  // GET /api/billing/refund - List refund history for the current familyspace's subscription
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'ADMIN')

    const refunds = await prisma.refund.findMany({
      where: { familyspaceId: user.familyspaceId },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(res, {
      refunds: refunds.map((r) => ({
        id: r.id,
        amountCents: r.amountCents,
        currency: r.currency,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt,
      })),
    })
  },
})

export default withRateLimit('billing', handler)
