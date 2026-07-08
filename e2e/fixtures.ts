import { test as base, expect as baseExpect, type BrowserContext, type Page } from '@playwright/test'
import { TestUser, BASE_URL, uniqueFakeIp, type SignUpOptions } from './helpers/api'

export { expect } from '@playwright/test'
export { TestUser, uniqueUserInfo, DEFAULT_PASSWORD } from './helpers/api'

/**
 * Shared fixtures.
 *
 * `user` — a brand-new, fully onboarded user whose session cookies are already
 * installed on the default browser context. Tests that request both `user` and
 * `page` get an authenticated page with zero UI login steps.
 *
 * Tests that need an unauthenticated page simply don't request `user`.
 * Tests that need a second user call `TestUser.signUp()` directly.
 */
interface Fixtures {
  user: TestUser
}

/**
 * Assert a visible alert containing the given text.
 * (A bare getByRole('alert') is ambiguous — Next.js's route announcer is also
 * a role="alert" element.)
 */
export async function expectAlert(page: Page, text: RegExp | string): Promise<void> {
  await baseExpect(page.getByRole('alert').filter({ hasText: text }).first()).toBeVisible()
}

/** Install a TestUser's session cookies on an existing browser context. */
export async function loginContext(context: BrowserContext, user: TestUser): Promise<void> {
  const state = await user.storageState()
  const url = new URL(BASE_URL)
  await context.addCookies([
    ...state.cookies,
    {
      name: 'e2e-bypass-mfa',
      value: 'true',
      domain: url.hostname,
      path: '/',
    },
  ])
}

export const test = base.extend<Fixtures>({
  // Every browser context presents its own synthetic client IP so per-IP rate
  // limits behave as they would for real, distinct users (see uniqueFakeIp).
  context: async ({ context }, use) => {
    await context.setExtraHTTPHeaders({ 'x-forwarded-for': uniqueFakeIp() })
    await use(context)
  },
  user: async ({ context }, use) => {
    const user = await TestUser.signUp()
    await loginContext(context, user)
    await use(user)
    await user.dispose()
  },
})

/** Convenience for specs that need a non-onboarded (fresh signup) user. */
export async function signUpFreshUser(
  context: BrowserContext,
  options: SignUpOptions = {},
): Promise<TestUser> {
  const user = await TestUser.signUp({ onboard: false, ...options })
  await loginContext(context, user)
  return user
}
