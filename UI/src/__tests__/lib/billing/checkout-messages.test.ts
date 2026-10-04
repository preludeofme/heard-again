import { describeCheckoutFailure, formatPlanSlug } from '@/lib/billing/checkout-messages'

describe('describeCheckoutFailure', () => {
  it('should only mention two-factor setup when a 403 actually says so', () => {
    const mfa = describeCheckoutFailure(403, 'Two-factor authentication is required')
    expect(mfa).toMatch(/two-factor security on the Security tab/i)

    const role = describeCheckoutFailure(403, 'Requires OWNER role or higher')
    expect(role).toMatch(/Requires OWNER role or higher/)
    expect(role).not.toMatch(/two-factor/i)
  })

  it('should tell the buyer to pick another plan when the plan is not purchasable', () => {
    const message = describeCheckoutFailure(404, 'Plan not found')
    expect(message).toMatch(/not open for cloud checkout/i)
    expect(message).toMatch(/pick another plan/i)
  })

  it('should point to signing in again when the session expired', () => {
    expect(describeCheckoutFailure(401)).toMatch(/sign in again/i)
  })

  it('should ask the buyer to wait when rate limited', () => {
    expect(describeCheckoutFailure(429)).toMatch(/wait a minute/i)
  })

  it('should name the payment processor when Stripe is unreachable', () => {
    expect(describeCheckoutFailure(503)).toMatch(/payment processor/i)
  })

  it('should fall back to the server message for an unmapped status', () => {
    expect(describeCheckoutFailure(400, 'Plan "Cloud Lite" does not support monthly billing')).toMatch(
      /does not support monthly billing/
    )
  })

  it('should state that nothing was charged for every failure', () => {
    for (const status of [400, 401, 403, 404, 429, 500, 503]) {
      expect(describeCheckoutFailure(status, 'some server message')).toMatch(/[Nn]othing has been charged/)
    }
  })
})

describe('formatPlanSlug', () => {
  it('should turn a plan slug into a readable label', () => {
    expect(formatPlanSlug('cloud_lite')).toBe('Cloud Lite')
    expect(formatPlanSlug('cloud-mid')).toBe('Cloud Mid')
    expect(formatPlanSlug('free')).toBe('Free')
  })
})
