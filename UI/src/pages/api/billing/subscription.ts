import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/logger'
import { EmailService } from '@/services/EmailService'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { withRateLimit } from '@/lib/security/rate-limiter'

const handler = apiHandler({
  // GET /api/billing/subscription - Get current subscription
  GET: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'VIEWER')

    const { session_id } = req.query
    if (typeof session_id === 'string' && session_id.startsWith('cs_')) {
      try {
        const session = await stripe.checkout.sessions.retrieve(session_id)
        if (
          (session.payment_status === 'paid' || session.status === 'complete') &&
          (session.client_reference_id === user.familyspaceId ||
            session.metadata?.familyspaceId === user.familyspaceId)
        ) {
          const planId = session.metadata?.planId
          if (planId) {
            const plan = await prisma.plan.findUnique({ where: { id: planId } })
            if (plan) {
              const currentSub = await prisma.subscription.findUnique({
                where: { familyspaceId: user.familyspaceId },
              })

              if (!currentSub || currentSub.planId !== plan.id) {
                const stripeCustomerId = session.customer as string
                const stripeSubscriptionId = session.subscription as string

                await prisma.subscription.updateMany({
                  where: { familyspaceId: user.familyspaceId },
                  data: {
                    stripeCustomerId,
                    stripeSubscriptionId,
                    billingStatus: 'ACTIVE',
                    planId: plan.id,
                  },
                })

                await prisma.familyspace.update({
                  where: { id: user.familyspaceId },
                  data: {
                    planType: plan.planType,
                    tunnelEnabled: plan.tunnelEnabled,
                    cloudGpuEnabled: plan.cloudGpuEnabled,
                    storageQuotaBytes: plan.storageQuotaBytes,
                    memberQuota: plan.memberQuota,
                    generationMinuteQuota: plan.generationMinutesIncluded,
                  },
                })

                // Send subscription confirmation email
                try {
                  const priceDisplay = (plan.priceMonthlyCents / 100).toFixed(2)
                  const baseUrl = process.env.UI_URL || process.env.NEXTAUTH_URL || ''
                  await EmailService.sendSubscriptionConfirmationEmail({
                    to: user.email,
                    userName: user.displayName || 'there',
                    planName: plan.name,
                    priceDisplay,
                    billingCycle: 'month',
                    baseUrl,
                  })
                  logger.info(`[Billing] Subscription confirmation email sent to ${user.email}`)
                } catch (emailErr: any) {
                  logger.error(`[Billing] Failed to send subscription confirmation email: ${emailErr.message}`)
                }
              }
            }
          }
        }
      } catch (err: any) {
        logger.error(`[Billing] Error syncing subscription with checkout session: ${err.message}`)
      }
    }

    const subscription = await prisma.subscription.findUnique({
      where: { familyspaceId: user.familyspaceId },
      include: { plan: true },
    })

    if (!subscription) {
      throw Errors.notFound('Subscription')
    }

    return successResponse(res, {
      id: subscription.id,
      billingStatus: subscription.billingStatus,
      renewalDate: subscription.renewalDate,
      cancelledAt: subscription.cancelledAt,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripeCustomerId: subscription.stripeCustomerId,
      usage: {
        generationMinutesUsed: subscription.generationMinutesUsed,
        storageBytesUsed: Number(subscription.storageBytesUsed),
        lastBillingResetAt: subscription.lastBillingResetAt,
      },
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      plan: subscription.plan ? {
        id: subscription.plan.id,
        name: subscription.plan.name,
        planType: subscription.plan.planType,
        pricing: {
          monthlyCents: subscription.plan.priceMonthlyCents,
          yearlyCents: subscription.plan.priceYearlyCents,
          monthlyDisplay: (subscription.plan.priceMonthlyCents / 100).toFixed(2),
          yearlyDisplay: subscription.plan.priceYearlyCents != null 
            ? (subscription.plan.priceYearlyCents / 100).toFixed(2) 
            : null,
        },
        entitlements: {
          tunnelEnabled: subscription.plan.tunnelEnabled,
          cloudGpuEnabled: subscription.plan.cloudGpuEnabled,
          cloudStorageEnabled: subscription.plan.cloudStorageEnabled,
          generationMinutesIncluded: subscription.plan.generationMinutesIncluded,
          storageQuotaBytes: Number(subscription.plan.storageQuotaBytes),
          memberQuota: subscription.plan.memberQuota,
          voiceProfileQuota: subscription.plan.voiceProfileQuota,
        },
        features: {
          prioritySupport: subscription.plan.prioritySupport,
          advancedAnalytics: subscription.plan.advancedAnalytics,
        },
      } : null,
    })
  },
})

export default withRateLimit('general', handler)
