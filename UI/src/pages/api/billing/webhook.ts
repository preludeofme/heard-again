import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse } from '@/lib/api-helpers'
import { downgradeFamilyspaceToFreePlan } from '@/server/services/billing-reconcile'

/**
 * POST /api/billing/webhook - Handle Stripe webhook events
 *
 * This endpoint processes Stripe webhook events for subscription lifecycle management:
 * - checkout.session.completed: New subscription created
 * - invoice.paid: Successful payment, extend subscription
 * - invoice.payment_failed: Payment failed, mark subscription past due
 * - customer.subscription.deleted: Subscription cancelled
 * - customer.subscription.updated: Subscription changed (plan upgrade/downgrade, scheduled
 *   cancellation, status transitions)
 * - charge.refunded: Refund processed (from our own /api/billing/refund or the Dashboard)
 */

export const config = {
  api: {
    bodyParser: false, // Stripe needs raw body for signature verification
  },
}

type InvoiceWithSubscription = {
  id?: string
  customer?: string
  /** Pre-2025-04-30.basil shape. The live webhook endpoint is still pinned to 2025-01-27.acacia. */
  subscription?: string | { id?: string } | null
  /** 2025-04-30.basil and later, including the SDK's pinned 2026-06-24.dahlia. */
  parent?: {
    subscription_details?: { subscription?: string | { id?: string } | null } | null
  } | null
}

/**
 * Resolve the subscription id from an invoice regardless of which Stripe API version
 * shaped the event. `invoice.subscription` was removed in 2025-04-30.basil and replaced
 * by `invoice.parent.subscription_details.subscription`, so reading only one of the two
 * makes these handlers no-op silently the moment the endpoint's API version changes.
 */
function resolveInvoiceSubscriptionId(invoice: InvoiceWithSubscription): string | undefined {
  const candidates = [invoice.parent?.subscription_details?.subscription, invoice.subscription]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate) return candidate
    if (candidate && typeof candidate === 'object' && candidate.id) return candidate.id
  }

  return undefined
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return errorResponse(res, 'Method not allowed', 405)
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    logger.error('[Billing] STRIPE_WEBHOOK_SECRET not configured')
    return errorResponse(res, 'Webhook not configured', 500)
  }

  // Read raw body
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk))
  }
  const rawBody = Buffer.concat(chunks)
  const signature = req.headers['stripe-signature'] as string

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err: any) {
    logger.error('[Billing] Webhook signature verification failed:', err.message)
    return errorResponse(res, 'Invalid signature', 400)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as {
          client_reference_id?: string
          customer?: string
          subscription?: string
          metadata?: { familyspaceId?: string; planId?: string }
        }
        
        const familyspaceId = session.metadata?.familyspaceId || session.client_reference_id
        const stripeCustomerId = session.customer as string
        const stripeSubscriptionId = session.subscription as string
        const planId = session.metadata?.planId

        if (!familyspaceId) {
          logger.error('[Billing] No familyspaceId in checkout session')
          break
        }

        // Look up the plan (if provided) so we can sync both the Subscription row
        // and the familyspace's entitlements in one pass — this is the actual
        // moment a plan upgrade/signup becomes real, since /api/billing/subscribe
        // only creates a Checkout Session and never writes the plan itself.
        const plan = planId ? await prisma.plan.findUnique({ where: { id: planId } }) : null

        const existingSub = await prisma.subscription.findUnique({
          where: { familyspaceId },
        })

        if (existingSub?.stripeSubscriptionId && existingSub.stripeSubscriptionId !== stripeSubscriptionId) {
          try {
            await stripe.subscriptions.cancel(existingSub.stripeSubscriptionId)
            logger.info(`[Billing] Cancelled previous subscription ${existingSub.stripeSubscriptionId} for familyspace ${familyspaceId}`)
          } catch (err: any) {
            logger.warn(`[Billing] Failed to cancel previous subscription ${existingSub.stripeSubscriptionId}: ${err.message}`)
          }
        }

        await prisma.subscription.updateMany({
          where: { familyspaceId },
          data: {
            stripeCustomerId,
            stripeSubscriptionId,
            billingStatus: 'ACTIVE',
            cancelAtPeriodEnd: false,
            cancelledAt: null,
            ...(plan ? { planId: plan.id } : {}),
          },
        })

        if (plan) {
          await prisma.familyspace.update({
            where: { id: familyspaceId },
            data: {
              planType: plan.planType,
              tunnelEnabled: plan.tunnelEnabled,
              cloudGpuEnabled: plan.cloudGpuEnabled,
              storageQuotaBytes: plan.storageQuotaBytes,
              memberQuota: plan.memberQuota,
              generationMinuteQuota: plan.generationMinutesIncluded,
            },
          })
        } else if (planId) {
          logger.error(`[Billing] Checkout session referenced unknown planId ${planId}`)
        }

        logger.info(`[Billing] Checkout completed for familyspace ${familyspaceId}`)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as InvoiceWithSubscription

        const stripeSubscriptionId = resolveInvoiceSubscriptionId(invoice)

        if (!stripeSubscriptionId) {
          logger.warn(`[Billing] invoice.paid ${invoice.id} carried no subscription id — skipping`)
          break
        }

        // Resolve the payment intent behind this invoice so a refund can be issued
        // against it later (see api/billing/refund.ts) without another Stripe round
        // trip at refund time. Best-effort — a failure here shouldn't fail the webhook.
        let paymentIntentId: string | undefined
        if (invoice.id) {
          try {
            const fullInvoice = await stripe.invoices.retrieve(invoice.id, {
              expand: ['payments.data.payment.payment_intent'],
            })
            const pi = fullInvoice.payments?.data?.[0]?.payment?.payment_intent
            paymentIntentId = typeof pi === 'string' ? pi : pi?.id
          } catch (err: any) {
            logger.warn(`[Billing] Could not resolve payment intent for invoice ${invoice.id}: ${err.message}`)
          }
        }

        // Don't trust this invoice's own `period_end` for the renewal date: the
        // invoice Stripe fires immediately when a trialing subscription starts
        // covers a zero-length $0 period (its period_end is "now", not the actual
        // trial end), which would show the wrong renewal date for the whole trial.
        // The subscription object's own current_period_end is authoritative in
        // both the trial and steady-state-renewal cases.
        let renewalDate: Date | undefined
        try {
          const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
          const periodEnd = subscription.items.data[0]?.current_period_end
          if (periodEnd) {
            renewalDate = new Date(periodEnd * 1000)
          }
        } catch (err: any) {
          logger.warn(`[Billing] Could not resolve current period end for subscription ${stripeSubscriptionId}: ${err.message}`)
        }

        // Extend subscription renewal date
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId },
          data: {
            billingStatus: 'ACTIVE',
            ...(renewalDate ? { renewalDate } : {}),
            lastBillingResetAt: new Date(),
            generationMinutesUsed: 0, // Reset usage for new period
            ...(paymentIntentId ? { stripeLatestPaymentIntentId: paymentIntentId } : {}),
          },
        })

        logger.info(`[Billing] Invoice paid for subscription ${stripeSubscriptionId}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as InvoiceWithSubscription

        const stripeSubscriptionId = resolveInvoiceSubscriptionId(invoice)

        if (!stripeSubscriptionId) {
          logger.warn(`[Billing] invoice.payment_failed ${invoice.id} carried no subscription id — skipping`)
          break
        }

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId },
          data: { billingStatus: 'PAST_DUE' },
        })


        logger.info(`[Billing] Payment failed for subscription ${stripeSubscriptionId}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as {
          id?: string
          customer?: string
        }
        
        const stripeSubscriptionId = subscription.id
        
        if (stripeSubscriptionId) {
          const existingSub = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId },
          })

          if (existingSub) {
            await downgradeFamilyspaceToFreePlan(existingSub.id, existingSub.familyspaceId)
          }
        }
        
        logger.info(`[Billing] Subscription ${stripeSubscriptionId} deleted`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as {
          id?: string
          status?: string
          cancel_at_period_end?: boolean
          metadata?: { planId?: string }
        }

        const stripeSubscriptionId = subscription.id

        if (stripeSubscriptionId) {
          const existingSub = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId },
          })

          if (existingSub) {
            // Always sync the scheduled-cancellation flag and a conservative status
            // mapping — regardless of whether this update also carries a plan change.
            const statusMap: Record<string, 'ACTIVE' | 'PAST_DUE' | undefined> = {
              active: 'ACTIVE',
              trialing: 'ACTIVE',
              past_due: 'PAST_DUE',
              unpaid: 'PAST_DUE',
            }
            const mappedStatus = subscription.status ? statusMap[subscription.status] : undefined

            await prisma.subscription.update({
              where: { id: existingSub.id },
              data: {
                cancelAtPeriodEnd: subscription.cancel_at_period_end ?? existingSub.cancelAtPeriodEnd,
                ...(mappedStatus ? { billingStatus: mappedStatus } : {}),
              },
            })

            // Plan change (upgrade/downgrade) carries the new planId in metadata.
            const planId = subscription.metadata?.planId
            if (planId) {
              const plan = await prisma.plan.findUnique({ where: { id: planId } })

              if (plan) {
                await prisma.subscription.update({
                  where: { id: existingSub.id },
                  data: { planId },
                })

                await prisma.familyspace.update({
                  where: { id: existingSub.familyspaceId },
                  data: {
                    planType: plan.planType,
                    tunnelEnabled: plan.tunnelEnabled,
                    cloudGpuEnabled: plan.cloudGpuEnabled,
                    storageQuotaBytes: plan.storageQuotaBytes,
                    memberQuota: plan.memberQuota,
                    generationMinuteQuota: plan.generationMinutesIncluded,
                  },
                })
              }
            }
          }
        }

        logger.info(`[Billing] Subscription ${stripeSubscriptionId} updated`)
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as {
          id?: string
          payment_intent?: string | null
          amount_refunded?: number
          currency?: string
          refunds?: { data?: Array<{ id: string; status: string | null }> }
        }

        const latestRefund = charge.refunds?.data?.[charge.refunds.data.length - 1]

        if (latestRefund) {
          const existingRefund = await prisma.refund.findUnique({
            where: { stripeRefundId: latestRefund.id },
          })

          const status = latestRefund.status === 'succeeded'
            ? 'SUCCEEDED'
            : latestRefund.status === 'failed'
              ? 'FAILED'
              : latestRefund.status === 'canceled'
                ? 'CANCELED'
                : 'PENDING'

          if (existingRefund) {
            // Reconcile a refund we initiated via /api/billing/refund.
            await prisma.refund.update({
              where: { id: existingRefund.id },
              data: { status },
            })
          } else if (charge.payment_intent) {
            // Refund initiated from the Stripe Dashboard, not our API — log it against
            // the matching subscription so it still shows up in refund history.
            const sub = await prisma.subscription.findFirst({
              where: { stripeLatestPaymentIntentId: charge.payment_intent },
            })

            if (sub) {
              await prisma.refund.create({
                data: {
                  subscriptionId: sub.id,
                  familyspaceId: sub.familyspaceId,
                  requestedById: 'stripe-dashboard',
                  amountCents: charge.amount_refunded ?? 0,
                  currency: charge.currency ?? 'usd',
                  status,
                  stripeRefundId: latestRefund.id,
                  stripePaymentIntentId: charge.payment_intent,
                },
              })
            }
          }
        }

        logger.info(`[Billing] Charge ${charge.id} refunded`)
        break
      }

      default:
        logger.info(`[Billing] Unhandled event type: ${event.type}`)
    }

    return successResponse(res, { received: true })
  } catch (error: any) {
    logger.error('[Billing] Webhook error:', error.message)
    return errorResponse(res, 'Webhook processing failed', 500)
  }
}
