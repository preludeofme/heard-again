import { test, expect } from './fixtures'

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
