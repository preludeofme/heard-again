import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse } from '@/lib/api-helpers'

/**
 * POST /api/billing/webhook - Handle Stripe webhook events
 *
 * This endpoint processes Stripe webhook events for subscription lifecycle management:
 * - checkout.session.completed: New subscription created
 * - invoice.paid: Successful payment, extend subscription
 * - invoice.payment_failed: Payment failed, mark subscription past due
 * - customer.subscription.deleted: Subscription cancelled
 * - customer.subscription.updated: Subscription changed (plan upgrade/downgrade)
 */

// Maximum allowed age of a webhook timestamp, to mitigate replay attacks.
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60

// Verify Stripe webhook signature per Stripe's documented algorithm
// (https://docs.stripe.com/webhooks#verify-manually), without requiring the Stripe SDK.
function verifyStripeSignature(payload: string, signatureHeader: string, secret: string): boolean {
  if (!signatureHeader || !secret) return false

  const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split('=')
    if (key && value) acc[key] = value
    return acc
  }, {})

  const timestamp = parts.t
  const v1Signature = parts.v1
  if (!timestamp || !v1Signature) return false

  const timestampSeconds = Number(timestamp)
  if (!Number.isFinite(timestampSeconds)) return false
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > WEBHOOK_TOLERANCE_SECONDS) {
    return false
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex')

  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  const actualBuffer = Buffer.from(v1Signature, 'hex')
  if (expectedBuffer.length !== actualBuffer.length) return false

  return timingSafeEqual(expectedBuffer, actualBuffer)
}

export const config = {
  api: {
    bodyParser: false, // Stripe needs raw body for signature verification
  },
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
  const rawBody = Buffer.concat(chunks).toString('utf-8')
  const signature = req.headers['stripe-signature'] as string

  // Verify signature
  const isValid = verifyStripeSignature(rawBody, signature, webhookSecret)
  if (!isValid) {
    return errorResponse(res, 'Invalid signature', 400)
  }

  let event: { type: string; data: { object: Record<string, unknown> } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return errorResponse(res, 'Invalid JSON', 400)
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
        
        if (!familyspaceId) {
          logger.error('[Billing] No familyspaceId in checkout session')
          break
        }

        // Update subscription with Stripe IDs
        await prisma.subscription.updateMany({
          where: { familyspaceId },
          data: {
            stripeCustomerId,
            stripeSubscriptionId,
            billingStatus: 'ACTIVE',
          },
        })
        
        logger.info(`[Billing] Checkout completed for familyspace ${familyspaceId}`)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as {
          customer?: string
          subscription?: string
          period_end?: number
        }
        
        const stripeSubscriptionId = invoice.subscription as string
        const periodEnd = invoice.period_end
        
        if (stripeSubscriptionId && periodEnd) {
          // Extend subscription renewal date
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId },
            data: {
              billingStatus: 'ACTIVE',
              renewalDate: new Date(periodEnd * 1000),
              lastBillingResetAt: new Date(),
              generationMinutesUsed: 0, // Reset usage for new period
            },
          })
        }
        
        logger.info(`[Billing] Invoice paid for subscription ${stripeSubscriptionId}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as {
          customer?: string
          subscription?: string
        }
        
        const stripeSubscriptionId = invoice.subscription as string
        
        if (stripeSubscriptionId) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId },
            data: { billingStatus: 'PAST_DUE' },
          })
        }
        
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
          // Downgrade to free plan
          const freePlan = await prisma.plan.findFirst({
            where: { planType: 'FREE', isActive: true },
          })
          
          if (freePlan) {
            const existingSub = await prisma.subscription.findFirst({
              where: { stripeSubscriptionId },
            })
            
            if (existingSub) {
              await prisma.subscription.update({
                where: { id: existingSub.id },
                data: {
                  planId: freePlan.id,
                  billingStatus: 'ACTIVE',
                  stripeSubscriptionId: null,
                  renewalDate: null,
                  cancelledAt: new Date(),
                },
              })
              
              // Downgrade familyspace
              await prisma.familyspace.update({
                where: { id: existingSub.familyspaceId },
                data: {
                  planType: 'FREE',
                  tunnelEnabled: false,
                  cloudGpuEnabled: false,
                  storageQuotaBytes: BigInt(0),
                  generationMinuteQuota: 0,
                },
              })
            }
          }
        }
        
        logger.info(`[Billing] Subscription ${stripeSubscriptionId} deleted`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as {
          id?: string
          status?: string
          plan?: { product?: string }
          metadata?: { planId?: string }
        }
        
        const stripeSubscriptionId = subscription.id
        const planId = subscription.metadata?.planId
        
        if (stripeSubscriptionId && planId) {
          // Update to new plan
          const plan = await prisma.plan.findUnique({
            where: { id: planId },
          })
          
          if (plan) {
            const existingSub = await prisma.subscription.findFirst({
              where: { stripeSubscriptionId },
            })
            
            if (existingSub) {
              await prisma.subscription.update({
                where: { id: existingSub.id },
                data: { planId },
              })
              
              // Update familyspace entitlements
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
        
        logger.info(`[Billing] Subscription ${stripeSubscriptionId} updated`)
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
