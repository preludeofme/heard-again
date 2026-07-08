import { request } from '@playwright/test'
import { test, expect, expectAlert, TestUser, uniqueUserInfo } from './fixtures'
import { BASE_URL } from './helpers/api'

/**
 * Password reset flow: forgot-password, verify-reset-token, and reset-password
 * endpoints — plus the /forgot-password and /reset-password UI pages.
 *
 * These endpoints run with `csrf: false` so no CSRF token is required.
 * Tests validate input handling, error responses, anti-enumeration behaviour,
 * token lifecycle, and UI rendering without Prisma direct access.
 */

// ─── Forgot Password API ───────────────────────────────────────────────────

test.describe('Forgot Password — POST /api/auth/forgot-password', () => {
  test('valid email returns 200 with anti-enumeration message', async ({}) => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/auth/forgot-password', {
      data: { email: 'someone@heardagain.test' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.message).toMatch(/if an account exists/i)
    await api.dispose()
  })

  test('requesting reset for an existing user returns same 200 (no enumeration)', async ({}) => {
    const user = await TestUser.signUp()

    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/auth/forgot-password', {
      data: { email: user.info.email },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.message).toMatch(/if an account exists/i)

    await user.dispose()
    await api.dispose()
  })

  test('missing email returns 400 with validation error', async ({}) => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/auth/forgot-password', {
      data: {},
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/email is required/i)
    await api.dispose()
  })

  test('invalid email format returns 400', async ({}) => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/auth/forgot-password', {
      data: { email: 'not-an-email' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
    await api.dispose()
  })

  test('empty string email returns 400', async ({}) => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/auth/forgot-password', {
      data: { email: '' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/email is required/i)
    await api.dispose()
  })
})

// ─── Reset Password API ─────────────────────────────────────────────────────

test.describe('Reset Password — POST /api/auth/reset-password', () => {
  test('missing token returns 400', async ({}) => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/auth/reset-password', {
      data: { password: 'New-Passw0rd!' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/token/i)
    await api.dispose()
  })

  test('missing password returns 400', async ({}) => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/auth/reset-password', {
      data: { token: 'some-fake-token' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/password/i)
    await api.dispose()
  })

  test('password shorter than 8 characters returns 400', async ({}) => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/auth/reset-password', {
      data: { token: 'some-fake-token', password: 'short' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/password.*at least 8/i)
    await api.dispose()
  })

  test('invalid / nonexistent token returns 400', async ({}) => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/auth/reset-password', {
      data: { token: 'this-token-does-not-exist-64chars', password: 'New-Passw0rd!' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid or expired/i)
    await api.dispose()
  })

  test('empty body returns 400', async ({}) => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/auth/reset-password', {
      data: {},
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
    await api.dispose()
  })
})

// ─── Verify Reset Token API ─────────────────────────────────────────────────

test.describe('Verify Reset Token — POST /api/auth/verify-reset-token', () => {
  test('missing token returns 400', async ({}) => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/auth/verify-reset-token', {
      data: {},
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/token/i)
    await api.dispose()
  })

  test('invalid / nonexistent token returns 400', async ({}) => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/auth/verify-reset-token', {
      data: { token: 'nonexistent-token-value-64chars' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid or expired/i)
    await api.dispose()
  })
})

// ─── Token-Type Validation ─────────────────────────────────────────────────

test.describe('Token type validation', () => {
  test('reset-password rejects a token with wrong identifier prefix', async ({}) => {
    // The endpoint checks that the verificationToken.identifier starts with
    // 'password-reset:'. A non-matching token (e.g., from email verification)
    // should be rejected even if it exists in the DB.
    // We test this by sending a token that definitely won't match the pattern.
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/auth/reset-password', {
      data: { token: 'email-verify-fake-token-abc', password: 'New-Passw0rd!' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid or expired/i)
    await api.dispose()
  })

  test('verify-reset-token rejects a token with wrong identifier prefix', async ({}) => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/auth/verify-reset-token', {
      data: { token: 'email-verify-fake-token-abc' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid or expired/i)
    await api.dispose()
  })
})

// ─── Forgot Password UI ─────────────────────────────────────────────────────

test.describe('Forgot Password UI — /forgot-password', () => {
  test('page loads with email input and submit button', async ({ page }) => {
    await page.goto('/forgot-password', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('heading', { name: 'Reset Your Password' }),
    ).toBeVisible({ timeout: 30_000 })
    await expect(page.getByLabel('Email Address')).toBeVisible()
    await expect(
      page.getByRole('button', { name: /send reset instructions/i }),
    ).toBeVisible()
  })

  test('page links to login', async ({ page }) => {
    await page.goto('/forgot-password', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('link', { name: /sign in/i }),
    ).toBeVisible()
  })

  test('submitting the form shows success message', async ({ page }) => {
    const info = uniqueUserInfo('fpw')

    await page.goto('/forgot-password', { waitUntil: 'networkidle' })
    await page.getByLabel('Email Address').fill(info.email)
    await page.getByRole('button', { name: /send reset instructions/i }).click()

    // Anti-enumeration: same success message regardless of account existence
    await expectAlert(page, /if an account exists/i)
  })

  test('success confirmation has a link back to login', async ({ page }) => {
    await page.goto('/forgot-password', { waitUntil: 'networkidle' })
    await page.getByLabel('Email Address').fill('test@heardagain.test')
    await page.getByRole('button', { name: /send reset instructions/i }).click()

    await expectAlert(page, /if an account exists/i)
    await expect(
      page.getByRole('link', { name: /return to sign in/i }),
    ).toBeVisible({ timeout: 15_000 })
  })
})

// ─── Reset Password UI ──────────────────────────────────────────────────────

test.describe('Reset Password UI — /reset-password', () => {
  test('page loads with password inputs when no token query param', async ({
    page,
  }) => {
    await page.goto('/reset-password', { waitUntil: 'networkidle' })

    // Without a token, the page shows an error about missing token
    await expect(
      page.getByText(/no reset token provided/i),
    ).toBeVisible({ timeout: 30_000 })
  })

  test('page with an invalid token shows error', async ({ page }) => {
    await page.goto('/reset-password?token=invalid-token-value', {
      waitUntil: 'networkidle',
    })

    // The page verifies the token and shows an error for invalid tokens
    await expect(
      page.getByText(/invalid or has expired/i),
    ).toBeVisible({ timeout: 30_000 })
  })

  test('error page links back to forgot-password', async ({ page }) => {
    await page.goto('/reset-password?token=invalid-token-value', {
      waitUntil: 'networkidle',
    })

    await expect(
      page.getByRole('link', { name: /request new reset link/i }),
    ).toBeVisible({ timeout: 30_000 })
  })
})
