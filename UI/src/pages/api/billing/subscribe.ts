import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
import { validate, rules } from '@/lib/validation'
export default apiHandler({
  // POST /api/billing/subscribe - Subscribe to a plan
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'OWNER')

    const { valid, errors } = validate(req.body, {
      planId: [rules.required],
      billingCycle: [rules.required, rules.oneOf(['monthly', 'yearly'])],
    })

    if (!valid) {
      throw Errors.badRequest('Validation failed', errors)
    }

    const { planId, billingCycle } = req.body

    // Get the plan
    const plan = await prisma.plan.findFirst({
      where: { id: planId, isActive: true },
    })

    if (!plan) {
      throw Errors.notFound('Plan')
    }

    // Check if workspace already has a subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { workspaceId: user.workspaceId },
    })

    // For now, simulate Stripe integration
    // In production, this would create a Stripe checkout session
    const mockStripeSubscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const mockStripeCustomerId = existingSubscription?.stripeCustomerId || `cus_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Calculate renewal date based on billing cycle
    const now = new Date()
    const renewalDate = billingCycle === 'yearly'
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())

    const subscription = await prisma.subscription.upsert({
      where: { workspaceId: user.workspaceId },
      update: {
        planId: plan.id,
        billingStatus: 'ACTIVE',
        stripeSubscriptionId: mockStripeSubscriptionId,
        stripeCustomerId: mockStripeCustomerId,
        renewalDate,
        cancelledAt: null,
        generationMinutesUsed: 0,
        storageBytesUsed: BigInt(0),
        lastBillingResetAt: now,
      },
      create: {
        workspaceId: user.workspaceId,
        planId: plan.id,
        billingStatus: 'ACTIVE',
        stripeSubscriptionId: mockStripeSubscriptionId,
        stripeCustomerId: mockStripeCustomerId,
        renewalDate,
        generationMinutesUsed: 0,
        storageBytesUsed: BigInt(0),
        lastBillingResetAt: now,
      },
    })

    // Update workspace entitlements from plan
    await prisma.workspace.update({
      where: { id: user.workspaceId },
      data: {
        planType: plan.planType,
        tunnelEnabled: plan.tunnelEnabled,
        cloudGpuEnabled: plan.cloudGpuEnabled,
        storageQuotaBytes: plan.storageQuotaBytes,
        memberQuota: plan.memberQuota,
        generationMinuteQuota: plan.generationMinutesIncluded,
      },
    })

    return successResponse(res, {
      subscription: {
        id: subscription.id,
        billingStatus: subscription.billingStatus,
        renewalDate: subscription.renewalDate,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
      },
      plan: {
        id: plan.id,
        name: plan.name,
        planType: plan.planType,
      },
      checkoutUrl: null, // In production, this would be the Stripe checkout URL
      message: 'Subscription created successfully. Stripe integration pending for production.',
    }, 201)
  },
})
