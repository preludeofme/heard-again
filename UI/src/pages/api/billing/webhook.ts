import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
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

// Verify Stripe webhook signature
async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    // In production, use Stripe library to verify signature
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // return stripe.webhooks.constructEvent(payload, signature, secret);
    
    // For now, simple validation (replace with actual Stripe verification in production)
    return !!signature && !!secret
  } catch {
    return false
  }
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
  const isValid = await verifyStripeSignature(rawBody, signature, webhookSecret)
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
          metadata?: { workspaceId?: string; planId?: string }
        }
        
        const workspaceId = session.metadata?.workspaceId || session.client_reference_id
        const stripeCustomerId = session.customer as string
        const stripeSubscriptionId = session.subscription as string
        
        if (!workspaceId) {
          logger.error('[Billing] No workspaceId in checkout session')
          break
        }

        // Update subscription with Stripe IDs
        await prisma.subscription.updateMany({
          where: { workspaceId },
          data: {
            stripeCustomerId,
            stripeSubscriptionId,
            billingStatus: 'ACTIVE',
          },
        })
        
        logger.info(`[Billing] Checkout completed for workspace ${workspaceId}`)
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
              
              // Downgrade workspace
              await prisma.workspace.update({
                where: { id: existingSub.workspaceId },
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
              
              // Update workspace entitlements
              await prisma.workspace.update({
                where: { id: existingSub.workspaceId },
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
