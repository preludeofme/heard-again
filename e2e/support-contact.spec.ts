import { request } from '@playwright/test'
import { test, expect, TestUser } from './fixtures'
import { BASE_URL } from './helpers/api'

/**
 * Support contact: API validation, submission, and page UI.
 *
 * The POST /api/support/contact endpoint is public (csrf: false) and
 * rate-limited under the "general" bucket (200 req/15 min). Name is optional;
 * email, subject, and message are required.
 */

const VALID_PAYLOAD = {
  name: 'E2E Tester',
  email: 'e2e-support@heardagain.test',
  subject: 'E2E support request',
  message: 'This is a test message from the E2E suite.',
}

// ─── Support Contact API ───────────────────────────────────────────────────

test.describe('Support Contact API', () => {
  test.describe('Valid submissions', () => {
    test('valid submission returns 200 as authenticated user', async ({ user }) => {
      const res = await user.postRaw('/api/support/contact', VALID_PAYLOAD)
      expect(res.status()).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.message).toMatch(/sent successfully/i)
    })

    test('valid submission returns 200 without authentication (public endpoint)', async () => {
      const api = await request.newContext({
        baseURL: BASE_URL,
        ignoreHTTPSErrors: true,
      })
      const res = await api.post('/api/support/contact', { data: VALID_PAYLOAD })
      expect(res.status()).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.message).toMatch(/sent successfully/i)
      await api.dispose()
    })

    test('submission with optional name omitted still succeeds', async () => {
      const api = await request.newContext({
        baseURL: BASE_URL,
        ignoreHTTPSErrors: true,
      })
      const res = await api.post('/api/support/contact', {
        data: {
          email: VALID_PAYLOAD.email,
          subject: VALID_PAYLOAD.subject,
          message: VALID_PAYLOAD.message,
        },
      })
      expect(res.status()).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      await api.dispose()
    })

    test('submission with empty name still succeeds (name is optional)', async () => {
      const api = await request.newContext({
        baseURL: BASE_URL,
        ignoreHTTPSErrors: true,
      })
      const res = await api.post('/api/support/contact', {
        data: { ...VALID_PAYLOAD, name: '' },
      })
      expect(res.status()).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      await api.dispose()
    })
  })

  test.describe('Validation errors', () => {
    test('missing email returns 400', async ({ user }) => {
      const res = await user.postRaw('/api/support/contact', {
        name: VALID_PAYLOAD.name,
        subject: VALID_PAYLOAD.subject,
        message: VALID_PAYLOAD.message,
      })
      expect(res.status()).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/validation/i)
    })

    test('missing subject returns 400', async ({ user }) => {
      const res = await user.postRaw('/api/support/contact', {
        name: VALID_PAYLOAD.name,
        email: VALID_PAYLOAD.email,
        message: VALID_PAYLOAD.message,
      })
      expect(res.status()).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/validation/i)
    })

    test('missing message returns 400', async ({ user }) => {
      const res = await user.postRaw('/api/support/contact', {
        name: VALID_PAYLOAD.name,
        email: VALID_PAYLOAD.email,
        subject: VALID_PAYLOAD.subject,
      })
      expect(res.status()).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/validation/i)
    })

    test('invalid email format returns 400', async ({ user }) => {
      const res = await user.postRaw('/api/support/contact', {
        ...VALID_PAYLOAD,
        email: 'not-an-email',
      })
      expect(res.status()).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/validation/i)
    })

    test('empty email returns 400', async ({ user }) => {
      const res = await user.postRaw('/api/support/contact', {
        ...VALID_PAYLOAD,
        email: '',
      })
      expect(res.status()).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/validation/i)
    })

    test('empty subject returns 400', async ({ user }) => {
      const res = await user.postRaw('/api/support/contact', {
        ...VALID_PAYLOAD,
        subject: '',
      })
      expect(res.status()).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/validation/i)
    })

    test('empty message returns 400', async ({ user }) => {
      const res = await user.postRaw('/api/support/contact', {
        ...VALID_PAYLOAD,
        message: '',
      })
      expect(res.status()).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/validation/i)
    })

    test('empty body returns 400', async ({ user }) => {
      const res = await user.postRaw('/api/support/contact', {})
      expect(res.status()).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/validation/i)
    })
  })

  test.describe('Edge cases', () => {
    test('message at max length (5000 chars) succeeds', async ({ user }) => {
      const res = await user.postRaw('/api/support/contact', {
        ...VALID_PAYLOAD,
        message: 'x'.repeat(5000),
      })
      expect(res.status()).toBe(200)
    })

    test('message exceeding 5000 chars returns 400', async ({ user }) => {
      const res = await user.postRaw('/api/support/contact', {
        ...VALID_PAYLOAD,
        message: 'x'.repeat(5001),
      })
      expect(res.status()).toBe(400)
    })

    test('subject exceeding 200 chars returns 400', async ({ user }) => {
      const res = await user.postRaw('/api/support/contact', {
        ...VALID_PAYLOAD,
        subject: 'x'.repeat(201),
      })
      expect(res.status()).toBe(400)
    })

    test('email exceeding 100 chars returns 400', async ({ user }) => {
      const longLocal = 'a'.repeat(91)
      const res = await user.postRaw('/api/support/contact', {
        ...VALID_PAYLOAD,
        email: `${longLocal}@test.com`,
      })
      expect(res.status()).toBe(400)
    })

    test('method not allowed (GET) returns 405', async ({ user }) => {
      const res = await user.api.get('/api/support/contact')
      expect(res.status()).toBe(405)
    })
  })
})

// ─── Support Page UI ───────────────────────────────────────────────────────

test.describe('Support page UI', () => {
  test('support page loads for authenticated user', async ({ page, user }) => {
    await page.goto('/support', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/support/, { timeout: 30_000 })
    await expect(
      page.getByRole('heading', { name: /how can we help/i }),
    ).toBeVisible({ timeout: 30_000 })
  })

  test('support page loads for unauthenticated (public) visitors', async ({
    browser,
  }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await context.newPage()

    await page.goto('/support', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('heading', { name: /how can we help/i }),
    ).toBeVisible({ timeout: 30_000 })

    await context.close()
  })

  test('page has contact form with required fields', async ({ page }) => {
    await page.goto('/support', { waitUntil: 'networkidle' })

    // Form element
    await expect(page.locator('#contact-form')).toBeVisible()

    // Form fields
    await expect(page.locator('#contact-name')).toBeVisible()
    await expect(page.locator('#contact-email')).toBeVisible()
    await expect(page.locator('#contact-subject')).toBeVisible()
    await expect(page.locator('#contact-message')).toBeVisible()
    await expect(page.locator('#contact-submit')).toBeVisible()

    // Name is clearly marked optional
    await expect(page.getByText(/your name/i)).toBeVisible()
  })

  test('page renders without errors (public)', async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await context.newPage()

    // Collect console errors during page load
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/support', { waitUntil: 'networkidle' })

    // Page body should have content and no blank screen
    await expect(page.locator('body')).not.toBeEmpty()
    expect(consoleErrors.length).toBe(0)

    await context.close()
  })

  test('form submission shows success state', async ({ page, user }) => {
    await page.goto('/support', { waitUntil: 'networkidle' })

    // Fill and submit
    await page.locator('#contact-name').fill(VALID_PAYLOAD.name)
    await page.locator('#contact-email').fill(user.info.email)
    await page.locator('#contact-subject').fill(VALID_PAYLOAD.subject)
    await page.locator('#contact-message').fill(VALID_PAYLOAD.message)
    await page.locator('#contact-submit').click()

    // Should show success state
    await expect(
      page.getByRole('heading', { name: /message sent/i }),
    ).toBeVisible({ timeout: 30_000 })

    // Should offer a link back to dashboard
    await expect(page.locator('#contact-success-home')).toBeVisible()
  })

  test('form submission fails gracefully with server error display', async ({
    page,
    user,
  }) => {
    await page.goto('/support', { waitUntil: 'networkidle' })

    // Submit with bad email to trigger client-side submission that gets a 400
    await page.locator('#contact-name').fill(VALID_PAYLOAD.name)
    await page.locator('#contact-email').fill('not-an-email')
    await page.locator('#contact-subject').fill(VALID_PAYLOAD.subject)
    await page.locator('#contact-message').fill(VALID_PAYLOAD.message)
    await page.locator('#contact-submit').click()

    // Error alert should appear
    await expect(page.locator('#contact-error-alert')).toBeVisible({
      timeout: 15_000,
    })
  })
})
