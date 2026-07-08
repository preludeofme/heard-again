import { test, expect, expectAlert, TestUser, uniqueUserInfo } from './fixtures'

/**
 * Authentication: registration, login, logout, password recovery entry point,
 * and unauthenticated redirects.
 */

test.describe('Registration', () => {
  test('new user can register and lands on onboarding @mobile', async ({ page }) => {
    const info = uniqueUserInfo('signup')

    await page.goto('/signup')
    await page.getByLabel('Email Address').fill(info.email)
    await page.getByLabel('Password', { exact: true }).fill(info.password)
    await page.getByLabel('Confirm Password', { exact: true }).fill(info.password)
    await page.getByLabel('First Name').fill(info.firstName)
    await page.getByLabel('Last Name').fill(info.lastName)
    await page.getByRole('button', { name: 'Create Account', exact: true }).click()

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 45_000 })
    await expect(page.getByText('What should we call your family story?')).toBeVisible()
  })

  test('registering with an existing email shows a friendly error', async ({ page }) => {
    const existing = await TestUser.signUp({ onboard: false })

    await page.goto('/signup')
    await page.getByLabel('Email Address').fill(existing.info.email)
    await page.getByLabel('Password', { exact: true }).fill(existing.info.password)
    await page.getByLabel('Confirm Password', { exact: true }).fill(existing.info.password)
    await page.getByLabel('First Name').fill('Duplicate')
    await page.getByLabel('Last Name').fill('Attempt')
    await page.getByRole('button', { name: 'Create Account', exact: true }).click()

    await expectAlert(page, /already exists/i)
    await expect(page).toHaveURL(/\/signup/)

    await existing.dispose()
  })

  test('mismatched passwords are rejected before submission', async ({ page }) => {
    const info = uniqueUserInfo('mismatch')

    await page.goto('/signup')
    await page.getByLabel('Email Address').fill(info.email)
    await page.getByLabel('Password', { exact: true }).fill(info.password)
    await page.getByLabel('Confirm Password', { exact: true }).fill(`${info.password}-different`)
    await page.getByLabel('First Name').fill(info.firstName)
    await page.getByLabel('Last Name').fill(info.lastName)
    await page.getByRole('button', { name: 'Create Account', exact: true }).click()

    await expectAlert(page, /passwords do not match/i)
    await expect(page).toHaveURL(/\/signup/)
  })
})

test.describe('Login', () => {
  test('valid credentials sign the user in @mobile', async ({ page }) => {
    const user = await TestUser.signUp()

    await page.goto('/login')
    await page.getByLabel('Email Address').fill(user.info.email)
    await page.getByLabel('Password', { exact: true }).fill(user.info.password)
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()

    // Successful login lands on the family legacy home.
    await expect(page).toHaveURL(/\/legacy/, { timeout: 45_000 })
    await expect(page.getByText(user.info.familyName).first()).toBeVisible()

    await user.dispose()
  })

  test('invalid credentials show an error and stay on the login page', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email Address').fill('nobody@heardagain.test')
    await page.getByLabel('Password', { exact: true }).fill('definitely-wrong-password')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()

    await expectAlert(page, /invalid email or password/i)
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page offers signup and password recovery links', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('link', { name: /create one/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible()
  })
})

test.describe('Logout', () => {
  test('signing out ends the session and re-protects private pages', async ({ page, user }) => {
    await page.goto('/legacy')
    await expect(page.getByText(user.info.familyName).first()).toBeVisible()

    await page.getByRole('button', { name: 'Open user menu' }).click()
    await page.getByRole('menuitem', { name: /sign out/i }).click()

    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 })

    // The session is really gone: private pages redirect again.
    await page.goto('/legacy')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Password recovery', () => {
  test('forgot-password accepts a request and shows a safe confirmation', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByRole('heading', { name: 'Reset Your Password' })).toBeVisible()

    await page.getByLabel('Email Address').fill(uniqueUserInfo('reset').email)
    await page.getByRole('button', { name: /send|reset/i }).click()

    // Anti-enumeration copy: the same confirmation shows whether or not the
    // account exists.
    await expectAlert(page, /if an account exists/i)
    await expect(page.getByRole('link', { name: /return to sign in/i })).toBeVisible()
  })
})

test.describe('Unauthenticated access', () => {
  const protectedPages = ['/legacy', '/family-tree', '/account', '/profile']

  for (const route of protectedPages) {
    test(`visiting ${route} unauthenticated redirects to login`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/login/)
    })
  }

  test('public pages render without a session', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible()

    await page.goto('/signup')
    await expect(page.getByRole('button', { name: 'Create Account', exact: true })).toBeVisible()

    await page.goto('/forgot-password')
    await expect(page.getByRole('heading', { name: 'Reset Your Password' })).toBeVisible()
  })
})

test.describe('Session persistence', () => {
  test('session survives navigation and reloads', async ({ page, user }) => {
    await page.goto('/legacy')
    await expect(page.getByText(user.info.familyName).first()).toBeVisible()

    await page.reload()
    await expect(page.getByText(user.info.familyName).first()).toBeVisible()

    await page.goto('/family-tree')
    await expect(page).toHaveURL(/\/family-tree/)
    await expect(page).not.toHaveURL(/\/login/)
  })
})
