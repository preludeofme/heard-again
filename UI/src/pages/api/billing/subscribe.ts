import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'
import { withRateLimit } from '@/lib/security/rate-limiter'

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

    if (!valid) {
      throw Errors.badRequest('Validation failed', errors)
    }

    const { planId, billingCycle } = req.body as { planId: string; billingCycle: 'monthly' | 'yearly' }

    // Plan may be referenced by its DB id or its public slug (e.g. "cloud_mid")
    const plan = await prisma.plan.findFirst({
      where: {
        isActive: true,
        OR: [{ id: planId }, { slug: planId }],
      },
    })

    if (!plan) {
      throw Errors.notFound('Plan')
    }

    const stripePriceId = billingCycle === 'yearly' ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly

    if (!stripePriceId) {
      throw Errors.badRequest(`Plan "${plan.name}" does not support ${billingCycle} billing`)
    }

    const existingSubscription = await prisma.subscription.findUnique({
      where: { familyspaceId: user.familyspaceId },
    })

    const baseUrl = process.env.UI_URL || process.env.NEXTAUTH_URL || ''

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
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
      success_url: `${baseUrl}/account?tab=subscription&checkout=success`,
      cancel_url: `${baseUrl}/account?tab=subscription&checkout=cancelled`,
    })

    return successResponse(res, {
      plan: {
        id: plan.id,
        slug: plan.slug,
        name: plan.name,
        planType: plan.planType,
      },
      checkoutUrl: session.url,
    }, 201)
  },
})

export default withRateLimit('billing', handler)
