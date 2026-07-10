import { test, expect } from '../fixtures'
import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'
import dotenv from 'dotenv'
import path from 'node:path'

dotenv.config({ path: path.resolve(__dirname, '../../UI/.env') })

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://trubuck-design:heardagain_dev@localhost:5432/heard_again'
    }
  }
})

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
  typescript: true,
})

/**
 * Billing and plans.
 *
 * Real Stripe Checkout is intentionally never COMPLETED here — the suite never
 * enters a card, charges anything, or leaves the app. What we lock down:
 *   - new accounts start on the Free plan with its entitlements
 *   - the plan catalog is exposed correctly
 *   - subscribe starts a Stripe test-mode Checkout session (URL only) and an
 *     abandoned checkout leaves the plan untouched
 */

test.describe('Free plan baseline', () => {
  test('a new account is on the Free plan with entitlements', async ({ user }) => {
    const res = await user.api.get('/api/billing/subscription')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data?.plan?.planType).toBe('FREE')
    expect(body.data?.plan?.entitlements).toBeTruthy()
  })

  test('usage endpoint reports fresh-account usage', async ({ user }) => {
    const res = await user.api.get('/api/billing/usage')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toBeTruthy()
  })

  test('free user can use core features immediately', async ({ user }) => {
    // Creating people and stories is not gated on a paid plan.
    const person = await user.postJson<{ id: string }>('/api/people', {
      firstName: 'Free',
      lastName: `Feature${Date.now().toString(36)}`,
    })
    expect(person.data?.id).toBeTruthy()
    const story = await user.createStory({ title: 'Free plan story' })
    expect(story.id).toBeTruthy()
  })
})

test.describe('Plan catalog', () => {
  test('plans API lists the available paid tiers', async ({ user }) => {
    const res = await user.api.get('/api/billing/plans')
    const body = await res.json()
    expect(body.success).toBe(true)
    const plans: Array<{ name: string; pricing?: unknown; entitlements?: unknown }> =
      body.data?.plans ?? []
    expect(Array.isArray(plans)).toBe(true)
    expect(plans.length).toBeGreaterThan(0)
    for (const plan of plans) {
      expect(plan.name).toBeTruthy()
      expect(plan.pricing).toBeTruthy()
      expect(plan.entitlements).toBeTruthy()
    }
  })
})

test.describe('Account subscription page', () => {
  test('account page shows the current plan', async ({ page, user }) => {
    await page.goto('/account?tab=subscription')
    await expect(page.getByText('Current Plan')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/free/i).first()).toBeVisible()
  })
})

test.describe('Subscription checkout', () => {
  test('subscribing starts a Stripe-hosted checkout without changing the plan', async ({
    user,
  }) => {
    // Stripe test mode: this creates a Checkout *session* (no card, no charge)
    // and the suite never navigates to it — which also covers the abandoned-
    // checkout case: the plan must stay FREE until a webhook confirms payment.
    const res = await user.postRaw('/api/billing/subscribe', {
      planId: 'cloud_mid',
      billingCycle: 'monthly',
    })
    expect([200, 201]).toContain(res.status())
    const body = await res.json()
    // Hosted checkout returns a URL; embedded checkout returns a client secret.
    const { checkoutUrl, clientSecret } = body.data ?? {}
    expect(checkoutUrl || clientSecret).toBeTruthy()
    if (checkoutUrl) expect(checkoutUrl).toMatch(/checkout\.stripe\.com/)

    // Checkout was started but never completed — still on the Free plan.
    const sub = await (await user.api.get('/api/billing/subscription')).json()
    expect(sub.data?.plan?.planType).toBe('FREE')
  })

  test('subscribing to an unknown plan is rejected', async ({ user }) => {
    const res = await user.postRaw('/api/billing/subscribe', {
      planId: 'not-a-real-plan',
      billingCycle: 'monthly',
    })
    expect([400, 404]).toContain(res.status())
  })
})

test.describe('Subscription lifecycle management', () => {
  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('user can subscribe to Lite, cancel at period end, resume, cancel immediately (downgrade)', async ({ page, user }) => {
    // 1. Setup: Create a real Stripe customer and subscription in test mode
    const customer = await stripe.customers.create({
      email: user.info.email,
      name: user.info.displayName,
    })

    // Find the Lite plan in the database
    const plan = await prisma.plan.findFirst({
      where: { slug: 'cloud_lite', isActive: true },
    })
    expect(plan).toBeTruthy()

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: plan!.stripePriceIdMonthly! }],
      trial_period_days: 14,
    })

    // Sync to database
    await prisma.subscription.update({
      where: { familyspaceId: user.familyspaceId! },
      data: {
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
        billingStatus: 'ACTIVE',
        planId: plan!.id,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        renewalDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    })

    await prisma.familyspace.update({
      where: { id: user.familyspaceId! },
      data: {
        planType: plan!.planType,
        tunnelEnabled: plan!.tunnelEnabled,
        cloudGpuEnabled: plan!.cloudGpuEnabled,
        storageQuotaBytes: plan!.storageQuotaBytes,
        memberQuota: plan!.memberQuota,
        generationMinuteQuota: plan!.generationMinutesIncluded,
      },
    })

    // 2. Go to account subscription page and cancel at period end
    await page.goto('/account?tab=subscription')
    await expect(page.getByText('Current Plan')).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('heading', { name: 'Cloud Access — Lite' })).toBeVisible()

    // Click "Cancel Subscription"
    await page.getByRole('button', { name: 'Cancel Subscription' }).click()
    
    // The dialog should appear
    await expect(page.getByText('Cancel Subscription?')).toBeVisible()
    
    // Click "Cancel Subscription" in the dialog (without immediate checkbox)
    await page.locator('button:has-text("Cancel Subscription")').nth(1).click()

    // Success message should appear
    await expect(page.getByText(/Subscription will cancel/i)).toBeVisible()

    // Wait for the UI to update to show resumption options
    await expect(page.getByRole('button', { name: 'Resume Subscription' })).toBeVisible()

    // Verify DB updated
    let dbSub = await prisma.subscription.findUnique({
      where: { familyspaceId: user.familyspaceId! },
    })
    expect(dbSub?.cancelAtPeriodEnd).toBe(true)
    expect(dbSub?.cancelledAt).not.toBeNull()

    // 3. Resume the subscription
    await page.getByRole('button', { name: 'Resume Subscription' }).click()
    await expect(page.getByText(/Subscription resumed/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel Subscription' })).toBeVisible()

    // Verify DB updated
    dbSub = await prisma.subscription.findUnique({
      where: { familyspaceId: user.familyspaceId! },
    })
    expect(dbSub?.cancelAtPeriodEnd).toBe(false)
    expect(dbSub?.cancelledAt).toBeNull()

    // 4. Cancel immediately (downgrade to Free)
    await page.getByRole('button', { name: 'Cancel Subscription' }).click()
    await expect(page.getByText('Cancel Subscription?')).toBeVisible()

    // Check "Cancel immediately instead"
    await page.getByLabel('Cancel immediately instead').check()

    // Click "Cancel Subscription" in the dialog
    await page.locator('button:has-text("Cancel Subscription")').nth(1).click()

    // Success message should appear
    await expect(page.getByText(/Subscription cancelled immediately and downgraded/i)).toBeVisible()

    // Verify UI reflects Free plan
    await expect(page.getByRole('heading', { name: /Free Local/i })).toBeVisible()

    // Verify DB is on Free plan
    dbSub = await prisma.subscription.findUnique({
      where: { familyspaceId: user.familyspaceId! },
      include: { plan: true },
    })
    expect(dbSub?.plan?.planType).toBe('FREE')

    const dbFamilyspace = await prisma.familyspace.findUnique({
      where: { id: user.familyspaceId! },
    })
    expect(dbFamilyspace?.planType).toBe('FREE')
  })
})

