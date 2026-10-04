import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'
import { withRateLimit } from '@/lib/security/rate-limiter'
import { recordCheckoutBlocked, recordCheckoutOpened } from '@/lib/analytics/funnel-server'
import { CHECKOUT_BLOCKED_REASONS } from '@/lib/analytics/funnel-steps'

const TRIAL_PERIOD_DAYS = 14

const handler = apiHandler({
  // POST /api/billing/subscribe - Start a Stripe Checkout session for a plan
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'OWNER')

    const { valid, errors } = validate(req.body, {
      planId: [rules.required],
      billingCycle: [rules.required, rules.oneOf(['monthly', 'yearly'])],
    })

    const { planId, billingCycle } = req.body as { planId: string; billingCycle: 'monthly' | 'yearly' }

    if (!valid) {
      recordCheckoutBlocked({
        plan: planId,
        billingCycle,
        reason: CHECKOUT_BLOCKED_REASONS.validationFailed,
      })
      throw Errors.badRequest('Validation failed', errors)
    }

    // Plan may be referenced by its DB id or its public slug (e.g. "cloud_mid")
    const plan = await prisma.plan.findFirst({
      where: {
        isActive: true,
        OR: [{ id: planId }, { slug: planId }],
      },
    })

    if (!plan) {
      recordCheckoutBlocked({
        plan: planId,
        billingCycle,
        reason: CHECKOUT_BLOCKED_REASONS.planNotFound,
      })
      throw Errors.notFound('Plan')
    }

    const stripePriceId = billingCycle === 'yearly' ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly

    if (!stripePriceId) {
      recordCheckoutBlocked({
        plan: plan.slug,
        billingCycle,
        reason: CHECKOUT_BLOCKED_REASONS.billingCycleUnsupported,
      })
      throw Errors.badRequest(`Plan "${plan.name}" does not support ${billingCycle} billing`)
    }

    const existingSubscription = await prisma.subscription.findUnique({
      where: { familyspaceId: user.familyspaceId },
    })

    const baseUrl = process.env.UI_URL || process.env.NEXTAUTH_URL || ''

    const createCheckoutSession = () => stripe.checkout.sessions.create({
      mode: 'subscription',
      ui_mode: 'embedded_page',
      line_items: [{ price: stripePriceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: TRIAL_PERIOD_DAYS,
        metadata: { familyspaceId: user.familyspaceId, planId: plan.id },
      },
      metadata: { familyspaceId: user.familyspaceId, planId: plan.id },
      client_reference_id: user.familyspaceId,
      ...(existingSubscription?.stripeCustomerId
        ? { customer: existingSubscription.stripeCustomerId }
        : { customer_email: user.email }),
      return_url: `${baseUrl}/account?tab=subscription&session_id={CHECKOUT_SESSION_ID}`,
    })

    // Step 5 of the pay funnel. Recorded here rather than only in the browser
    // because this is the moment a checkout either exists or does not, and a
    // Stripe failure is the one drop-off the client can never report.
    let session: Awaited<ReturnType<typeof createCheckoutSession>>
    try {
      session = await createCheckoutSession()
    } catch (error) {
      recordCheckoutBlocked({
        plan: plan.slug,
        billingCycle,
        reason: CHECKOUT_BLOCKED_REASONS.stripeError,
      })
      throw error
    }

    recordCheckoutOpened({
      plan: plan.slug,
      billingCycle,
      isEmbedded: Boolean(session.client_secret),
    })

    return successResponse(res, {
      plan: {
        id: plan.id,
        slug: plan.slug,
        name: plan.name,
        planType: plan.planType,
      },
      checkoutUrl: session.url,
      clientSecret: session.client_secret,
    }, 201)
  },
})

export default withRateLimit('billing', handler)
