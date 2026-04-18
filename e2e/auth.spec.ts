import { test, expect } from '@playwright/test'

/**
 * Critical-path E2E: authentication flow.
 *
 * Prerequisites:
 *   - App is running at http://localhost:4777
 *   - E2E_TEST_EMAIL and E2E_TEST_PASSWORD env vars are set to a valid test account
 */
test.describe('Authentication flow', () => {
  test('should redirect unauthenticated user from /profile to /login', async ({ page }) => {
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login/)
  })

  test('should show login form on /login', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /sign in|log in|welcome/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test('should log in with valid credentials and redirect to profile', async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL
    const password = process.env.E2E_TEST_PASSWORD

    test.skip(!email || !password, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set')

    await page.goto('/login')
    await page.getByLabel(/email/i).fill(email!)
    await page.getByLabel(/password/i).fill(password!)
    await page.getByRole('button', { name: /sign in|log in/i }).click()

    await expect(page).toHaveURL(/\/profile|\/dashboard/, { timeout: 10000 })
  })
})
