import { request } from '@playwright/test'
import { test, expect, TestUser } from './fixtures'
import { BASE_URL, uniqueFakeIp } from './helpers/api'

/**
 * Access control: unauthenticated API access, cross-familyspace isolation,
 * CSRF enforcement, and security headers.
 */

test.describe('Unauthenticated API access', () => {
  const protectedEndpoints = [
    '/api/billing/subscription',
    '/api/dashboard/stats',
    '/api/stories',
    '/api/people',
    '/api/voice/consent',
  ]

  for (const endpoint of protectedEndpoints) {
    test(`GET ${endpoint} without a session returns 401`, async () => {
      const api = await request.newContext({
        baseURL: BASE_URL,
        ignoreHTTPSErrors: true,
        extraHTTPHeaders: { 'x-forwarded-for': uniqueFakeIp() },
      })
      const res = await api.get(endpoint)
      expect(res.status()).toBe(401)
      await api.dispose()
    })
  }
})

test.describe('Cross-familyspace isolation', () => {
  let alice: TestUser
  let bob: TestUser
  let aliceStoryId: string

  test.beforeAll(async () => {
    alice = await TestUser.signUp()
    bob = await TestUser.signUp()
    aliceStoryId = (await alice.createStory({ title: 'Alice Private Story' })).id
  })

  test.afterAll(async () => {
    await alice.dispose()
    await bob.dispose()
  })

  test("user B cannot read user A's person record", async () => {
    const res = await bob.api.get(`/api/people/${alice.personId}`)
    expect([403, 404]).toContain(res.status())
  })

  test("user B cannot read user A's story", async () => {
    const res = await bob.api.get(`/api/stories/${aliceStoryId}`)
    expect([403, 404]).toContain(res.status())
  })

  test("user B cannot edit user A's story", async () => {
    const res = await bob.putRaw(`/api/stories/${aliceStoryId}`, {
      title: 'Hijacked',
      content: '<p>Hijacked</p>',
    })
    expect([403, 404]).toContain(res.status())

    // The story is untouched for its real owner.
    const check = await alice.api.get(`/api/stories/${aliceStoryId}`)
    const body = await check.json()
    expect(body.data?.title ?? body.data?.story?.title).toBe('Alice Private Story')
  })

  test("user B cannot delete user A's story", async () => {
    const res = await bob.deleteRaw(`/api/stories/${aliceStoryId}`)
    expect([403, 404]).toContain(res.status())
    expect((await alice.api.get(`/api/stories/${aliceStoryId}`)).status()).toBe(200)
  })

  test("user B's browser cannot view user A's story page", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: await bob.storageState(),
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { 'x-forwarded-for': bob.fakeIp },
    })
    const page = await context.newPage()
    await page.goto(`/stories/${aliceStoryId}`)

    // The private content must never render for another familyspace.
    await expect(page.getByText('Alice Private Story')).toHaveCount(0)
    await context.close()
  })

  test("user B's story list never contains user A's stories", async () => {
    const res = await bob.api.get('/api/stories')
    const body = await res.json()
    const stories = body.data?.stories ?? body.data ?? []
    const leaked = (Array.isArray(stories) ? stories : []).find(
      (s: { id: string }) => s.id === aliceStoryId,
    )
    expect(leaked).toBeFalsy()
  })
})

test.describe('Deleted resources', () => {
  test('a deleted story is not retrievable', async () => {
    const user = await TestUser.signUp()
    const { id } = await user.createStory()

    const del = await user.deleteRaw(`/api/stories/${id}`)
    expect(del.ok()).toBe(true)
    expect((await user.api.get(`/api/stories/${id}`)).status()).toBe(404)

    await user.dispose()
  })
})

test.describe('CSRF protection', () => {
  test('mutations without a CSRF token are rejected', async () => {
    const user = await TestUser.signUp()

    // Same session, no x-csrf-token header.
    const res = await user.api.post('/api/stories', {
      data: { title: 'No CSRF', content: '<p>No CSRF</p>', subjectId: user.personId },
    })
    expect(res.status()).toBe(403)

    await user.dispose()
  })
})

test.describe('Security headers', () => {
  test('responses carry the core security headers', async ({ page }) => {
    const response = await page.goto('/login')
    const headers = response!.headers()
    expect(headers['x-content-type-options']).toBeTruthy()
    expect(headers['x-frame-options']).toBeTruthy()
    expect(headers['content-security-policy']).toBeTruthy()
    expect(headers['referrer-policy']).toBeTruthy()
  })
})
