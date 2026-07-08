import { request } from '@playwright/test'
import { test, expect, TestUser } from './fixtures'
import { BASE_URL } from './helpers/api'

/**
 * Account security: password management, MFA (multi-factor authentication),
 * privacy & data rights, account settings UI, and edge cases.
 */

// ─── Password Management ───────────────────────────────────────────────────

test.describe('Password management', () => {
  test('can change password with valid credentials', async ({ user }) => {
    const res = await user.postRaw('/api/user/password', {
      currentPassword: user.info.password,
      newPassword: 'New-Passw0rd!Secure',
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.message).toMatch(/password updated/i)
    expect(body.strength).toBeTruthy()
  })

  test('old password is required to change password', async ({ user }) => {
    const res = await user.postRaw('/api/user/password', {
      newPassword: 'New-Passw0rd!Secure',
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/current password/i)
  })

  test('new password must meet policy requirements', async ({ user }) => {
    const res = await user.postRaw('/api/user/password', {
      currentPassword: user.info.password,
      newPassword: 'short',
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/security requirements/i)
  })

  test('weak passwords are rejected with details', async ({ user }) => {
    const res = await user.postRaw('/api/user/password', {
      currentPassword: user.info.password,
      newPassword: 'password',
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/security requirements/i)
    expect(body.details).toBeTruthy()
  })

  test('password change with wrong current password is rejected', async ({
    user,
  }) => {
    const res = await user.postRaw('/api/user/password', {
      currentPassword: 'wrong-password',
      newPassword: 'New-Passw0rd!Secure',
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/incorrect/i)
  })

  test('password change includes strength assessment', async ({ user }) => {
    const res = await user.postRaw('/api/user/password', {
      currentPassword: user.info.password,
      newPassword: 'Very-Str0ng!Passphrase#42',
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.strength).toBe('strong')
  })
})

// ─── MFA (Multi-Factor Auth) ──────────────────────────────────────────────

test.describe('MFA — status checks', () => {
  test('fresh user does not have MFA enabled', async ({ user }) => {
    const res = await user.api.get('/api/user/mfa')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.enabled).toBe(false)
    expect(body.method).toBeNull()
  })

  test('mfa-status-by-email returns false for unknown email', async ({}) => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/user/mfa-status-by-email', {
      data: { email: 'nonexistent@heardagain.test' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.mfaEnabled).toBe(false)
    await api.dispose()
  })

  test('mfa-status-by-email returns details for existing user', async ({
    user,
  }) => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/user/mfa-status-by-email', {
      data: { email: user.info.email },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('mfaEnabled')
    expect(body.email).toBe(user.info.email)
    await api.dispose()
  })
})

test.describe('MFA — setup and verification', () => {
  test('can initiate email MFA setup', async ({ user }) => {
    const res = await user.postRaw('/api/user/mfa', { method: 'email' })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.method).toBe('email')
  })

  test('can initiate TOTP MFA setup', async ({ user }) => {
    const res = await user.postRaw('/api/user/mfa', { method: 'totp' })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.method).toBe('totp')
    expect(body.qrCode).toBeTruthy()
  })

  test('verification with invalid code is rejected', async ({ user }) => {
    const res = await user.postRaw('/api/user/mfa', { method: 'email' })
    expect(res.status()).toBe(200)

    // Try to verify with a bad code (PUT method)
    const verifyRes = await user.api.put('/api/user/mfa', {
      headers: { 'x-csrf-token': await user.csrf() },
      data: { code: '000000' },
    })
    expect(verifyRes.status()).toBe(400)
    const body = await verifyRes.json()
    expect(body.error).toBeTruthy()
  })

  test('MFA disable requires password', async ({ user }) => {
    const res = await user.api.delete('/api/user/mfa', {
      headers: { 'x-csrf-token': await user.csrf() },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  test('MFA verify endpoint returns error without code', async ({ user }) => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/auth/mfa-verify', {
      data: { email: user.info.email, action: 'verify' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/code/i)
    await api.dispose()
  })
})

test.describe('MFA — edge cases', () => {
  test('cannot enable MFA for non-existent email', async () => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/user/mfa-status-by-email', {
      data: { email: 'ghost@heardagain.test' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.mfaEnabled).toBe(false)
    await api.dispose()
  })

  test('mfa-status-by-email requires an email', async () => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/user/mfa-status-by-email', {
      data: {},
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/email/i)
    await api.dispose()
  })

  test('MFA setup without session returns 401', async () => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const res = await api.post('/api/user/mfa', {
      data: { method: 'email' },
    })
    expect(res.status()).toBe(401)
    await api.dispose()
  })
})

// ─── Privacy & Data Rights ────────────────────────────────────────────────

test.describe('Privacy — permanent deletion', () => {
  test('permanent deletion requires confirmation text', async ({ user }) => {
    const res = await user.postRaw('/api/privacy/permanent-deletion', {
      confirmationText: 'wrong text',
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/DELETE MY ACCOUNT/i)
  })

  test('deletion rejects missing confirmation text', async ({ user }) => {
    const res = await user.postRaw('/api/privacy/permanent-deletion', {})
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/confirmationText/i)
  })

  test('permanent deletion with correct text succeeds', async () => {
    // Create a dedicated user for deletion — we don't want to nuke the shared fixture user
    const victim = await TestUser.signUp()
    const res = await victim.postRaw('/api/privacy/permanent-deletion', {
      confirmationText: 'DELETE MY ACCOUNT',
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.deleted).toBe(true)
    expect(body.data.deletedAt).toBeTruthy()
    expect(body.data.redactedEmail).toBeTruthy()

    await victim.dispose()
  })

  test('already-deleted user returns alreadyDeleted flag', async () => {
    const victim = await TestUser.signUp()

    // First deletion
    const first = await victim.postRaw('/api/privacy/permanent-deletion', {
      confirmationText: 'DELETE MY ACCOUNT',
    })
    expect(first.status()).toBe(200)
    const firstBody = await first.json()
    expect(firstBody.data.deleted).toBe(true)

    // Second deletion — should return alreadyDeleted
    const second = await victim.postRaw('/api/privacy/permanent-deletion', {
      confirmationText: 'DELETE MY ACCOUNT',
    })
    expect(second.status()).toBe(200)
    const secondBody = await second.json()
    expect(secondBody.data.alreadyDeleted).toBe(true)

    await victim.dispose()
  })
})

test.describe('Privacy — pages', () => {
  test('privacy settings page loads for authenticated user', async ({
    page,
    user,
  }) => {
    await page.goto('/privacy-settings', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/privacy-settings/, { timeout: 30000 })
    // Page should render (may show settings related to privacy)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('privacy policy page loads', async ({ page }) => {
    await page.goto('/privacy', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('heading', { name: /privacy policy/i }),
    ).toBeVisible({ timeout: 30000 })
  })

  test('terms page loads', async ({ page }) => {
    await page.goto('/terms', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('heading', { name: /terms of service/i }),
    ).toBeVisible()
  })

  test('privacy and terms pages are publicly accessible', async ({
    browser,
  }) => {
    // Open without cookies/session
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await context.newPage()

    await page.goto('/privacy', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('heading', { name: /privacy policy/i }),
    ).toBeVisible()

    await page.goto('/terms', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('heading', { name: /terms of service/i }),
    ).toBeVisible()

    await context.close()
  })
})

// ─── Account Settings UI ──────────────────────────────────────────────────

test.describe('Account settings UI', () => {
  test('account page loads and shows user info', async ({ page, user }) => {
    await page.goto('/account', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('heading', { name: /account settings/i }),
    ).toBeVisible({ timeout: 30_000 })

    // Profile tab shows user info
    await expect(page.getByText(user.info.email)).toBeVisible()
  })

  test('account page has subscription tab that shows plan', async ({
    page,
    user,
  }) => {
    await page.goto('/account?tab=subscription', { waitUntil: 'networkidle' })
    await expect(page.getByText('Current Plan')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/free/i).first()).toBeVisible()
  })

  test('security settings tab renders for credential users', async ({
    page,
    user,
  }) => {
    await page.goto('/account?tab=security', { waitUntil: 'networkidle' })
    // The SecuritySettings component renders with the "Login code" section
    await expect(page.getByText(/login code/i).first()).toBeVisible({
      timeout: 30_000,
    })
  })

  test('security tab has setup CTA when MFA is not enabled', async ({
    page,
    user,
  }) => {
    await page.goto('/account?tab=security', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('button', { name: /set up login code/i }),
    ).toBeVisible({ timeout: 30_000 })
  })
})

// ─── Security — unauthenticated API access ─────────────────────────────────

test.describe('Unauthenticated security endpoints', () => {
  const protectedSecurityEndpoints = [
    '/api/user/password',
    '/api/user/mfa',
    '/api/privacy/permanent-deletion',
  ]

  for (const endpoint of protectedSecurityEndpoints) {
    test(`POST ${endpoint} without session returns 401`, async () => {
      const api = await request.newContext({
        baseURL: BASE_URL,
        ignoreHTTPSErrors: true,
      })
      const res = await api.post(endpoint, {
        data: {},
      })
      expect(res.status()).toBe(401)
      await api.dispose()
    })
  }
})
