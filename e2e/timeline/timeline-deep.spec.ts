import { request } from '@playwright/test'
import { test, expect, TestUser } from './fixtures'
import { BASE_URL, uniqueFakeIp } from './helpers/api'

/**
 * Timeline — deep functional tests for the /api/timeline endpoint and the
 * Life Journey lens UI.
 *
 * API:                  GET /api/timeline?personId=&dateFrom=&dateTo=&page=&limit=
 * UI:                   /timeline  →  redirects to /legacy?lens=journey
 *
 * Event types in response:  birth | death | marriage | divorce | story | document | custom
 * Each event has:           id, type, date, datePrecision, title, description?, people[], sourceId, sourceType
 */

// ---------------------------------------------------------------------------
// Timeline API
// ---------------------------------------------------------------------------
test.describe('Timeline API', () => {
  test('GET /api/timeline returns events for the familyspace', async ({ user }) => {
    const res = await user.api.get('/api/timeline')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.pagination).toBeTruthy()
    expect(typeof body.pagination.total).toBe('number')
  })

  test('response includes events with type, date, title, and people', async ({ user }) => {
    // Create a story so we have at least one timeline event with a storyDate
    const storyTitle = `Timeline Event ${Date.now().toString(36)}`
    await user.createStory({ title: storyTitle })

    const res = await user.api.get('/api/timeline?limit=100')
    const body = await res.json()
    expect(body.success).toBe(true)

    const events: any[] = body.data ?? []
    expect(events.length).toBeGreaterThan(0)

    // Every event must carry the expected shape
    for (const event of events) {
      expect(event).toHaveProperty('id')
      expect(event).toHaveProperty('type')
      // date can be null for events without a date; the property must still exist
      expect(event).toHaveProperty('date')
      expect(event).toHaveProperty('title')
      expect(Array.isArray(event.people)).toBe(true)
      expect(event).toHaveProperty('sourceId')
      expect(event).toHaveProperty('sourceType')
    }
  })

  test('events include story events (type: story)', async ({ user }) => {
    const storyTitle = `Story Timeline ${Date.now().toString(36)}`
    await user.createStory({ title: storyTitle })

    const res = await user.api.get('/api/timeline?limit=100')
    const body = await res.json()
    const events: any[] = body.data ?? []

    const storyEvents = events.filter((e) => e.type === 'story')
    expect(storyEvents.length).toBeGreaterThan(0)
    expect(storyEvents.some((e) => e.title === storyTitle)).toBe(true)
  })

  test('events include person life events (birth)', async ({ user }) => {
    // Every onboarded user has a birth-date set, so their own birth should appear
    const res = await user.api.get('/api/timeline?limit=100')
    const body = await res.json()
    const events: any[] = body.data ?? []

    const birthEvents = events.filter((e) => e.type === 'birth')
    expect(birthEvents.length).toBeGreaterThan(0)

    // At least one birth event mentions the user's name
    const ownBirth = birthEvents.some((e) =>
      e.people?.some(
        (p: { firstName: string }) => p.firstName === user.info.firstName,
      ),
    )
    expect(ownBirth).toBe(true)
  })

  test('filter by personId narrows results', async ({ user }) => {
    // Unfiltered should include the user's birth
    const allRes = await user.api.get('/api/timeline?limit=100')
    const allBody = await allRes.json()
    const allCount = allBody.pagination.total

    // Filtered to user's personId
    const filteredRes = await user.api.get(
      `/api/timeline?personId=${user.personId}&limit=100`,
    )
    const filteredBody = await filteredRes.json()

    // Filtered count should be ≤ unfiltered count
    expect(filteredBody.pagination.total).toBeLessThanOrEqual(allCount)
    expect(filteredBody.success).toBe(true)

    // Every returned event should involve this person
    const events: any[] = filteredBody.data ?? []
    for (const event of events) {
      const personIds = event.people?.map((p: { id: string }) => p.id) ?? []
      expect(personIds).toContain(user.personId)
    }
  })

  test('filter by date range (dateFrom / dateTo)', async ({ user }) => {
    // Get all events first so we know there's at least one with a date
    const allRes = await user.api.get('/api/timeline?limit=200')
    const allBody = await allRes.json()
    const eventsWithDates: any[] = (allBody.data ?? []).filter((e: any) => e.date)

    if (eventsWithDates.length === 0) {
      test.skip(true, 'No dated events to filter — skipping date-range test')
      return
    }

    // Pick the earliest event date as dateFrom
    const earliest = new Date(
      Math.min(...eventsWithDates.map((e: any) => new Date(e.date).getTime())),
    )
    const dateFrom = earliest.toISOString().split('T')[0]

    const res = await user.api.get(
      `/api/timeline?dateFrom=${dateFrom}&limit=100`,
    )
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.pagination.total).toBeGreaterThan(0)

    // Future dateTo should still return all events
    const futureDate = '2099-12-31'
    const futureRes = await user.api.get(
      `/api/timeline?dateTo=${futureDate}&limit=100`,
    )
    const futureBody = await futureRes.json()
    expect(futureBody.success).toBe(true)
  })

  test('respects limit parameter', async ({ user }) => {
    // Create several stories to ensure we exceed a small limit
    for (let i = 0; i < 5; i++) {
      await user.createStory({
        title: `Limit Test Story ${i} ${Date.now().toString(36)}`,
      })
    }

    const smallRes = await user.api.get('/api/timeline?limit=2')
    const smallBody = await smallRes.json()
    expect(smallBody.success).toBe(true)
    expect(smallBody.data.length).toBeLessThanOrEqual(2)
    expect(smallBody.pagination.limit).toBe(2)
  })

  test('sort order is chronological (oldest first)', async ({ user }) => {
    const res = await user.api.get('/api/timeline?limit=100')
    const body = await res.json()
    const events: any[] = (body.data ?? []).filter((e: any) => e.date)

    if (events.length < 2) {
      test.skip(true, 'Fewer than 2 dated events — skipping sort-order test')
      return
    }

    for (let i = 1; i < events.length; i++) {
      const prev = new Date(events[i - 1].date).getTime()
      const curr = new Date(events[i].date).getTime()
      expect(curr).toBeGreaterThanOrEqual(prev)
    }
  })

  test("cross-tenancy: user B cannot see user A's timeline", async () => {
    const alice = await TestUser.signUp()
    const bob = await TestUser.signUp()

    // Alice creates a story so she has unique timeline content
    const marker = `alice-only-${Date.now().toString(36)}`
    await alice.createStory({ title: marker })

    // Bob queries timeline — must not see Alice's events
    const res = await bob.api.get('/api/timeline?limit=200')
    const body = await res.json()
    const events: any[] = body.data ?? []

    const aliceEvents = events.filter((e: any) => {
      if (e.title === marker) return true
      // Check people arrays for Alice's person
      if (e.people?.some((p: { id: string }) => p.id === alice.personId))
        return true
      return false
    })
    expect(aliceEvents.length).toBe(0)

    await alice.dispose()
    await bob.dispose()
  })
})

// ---------------------------------------------------------------------------
// Timeline UI
// ---------------------------------------------------------------------------
test.describe('Timeline UI', () => {
  test('/timeline redirects to the journey lens', async ({ page, user }) => {
    await page.goto('/timeline', { waitUntil: 'networkidle' })
    // The redirect replaces to /legacy?lens=journey
    await expect(page).toHaveURL(/\/legacy\?.*lens=journey/, { timeout: 15_000 })
  })

  test('journey lens shows the timeline header', async ({ page, user }) => {
    await page.goto('/legacy?lens=journey', { waitUntil: 'networkidle' })
    // The Life Journey heading should be visible once loaded
    await expect(
      page.getByText('Life Journey').first(),
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByText('The Timeline').first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('timeline shows story events when stories exist', async ({ page, user }) => {
    const storyTitle = `UI Timeline ${Date.now().toString(36)}`
    await user.createStory({ title: storyTitle })

    await page.goto('/legacy?lens=journey', { waitUntil: 'networkidle' })

    // The timeline card should render the story title
    await expect(
      page.getByText(storyTitle).first(),
    ).toBeVisible({ timeout: 30_000 })
  })

  test('timeline handles empty state (no events)', async ({ page, user }) => {
    // A brand-new onboarded user without any stories/documents/custom events
    // should see the empty-state prompt.
    await page.goto('/legacy?lens=journey', { waitUntil: 'networkidle' })

    // The empty-state copy for the journey lens
    await expect(
      page.getByText(/Every legacy starts with one memory/i).first(),
    ).toBeVisible({ timeout: 30_000 })
    await expect(
      page.getByRole('link', { name: /Add a Family Member/i }),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('timeline is navigable — type filter buttons work', async ({ page, user }) => {
    await user.createStory({ title: `Navigable ${Date.now().toString(36)}` })

    await page.goto('/legacy?lens=journey', { waitUntil: 'networkidle' })

    // The filter pills should appear after events load
    const storiesBtn = page.getByRole('button', { name: /Stories/i })
    await expect(storiesBtn).toBeVisible({ timeout: 30_000 })

    // Click the Stories filter — should still render (single-filter)
    await storiesBtn.click()
    // Toggling a filter shouldn't break the page
    await expect(page.getByText('Life Journey').first()).toBeVisible()

    // Click "All" to reset
    const allBtn = page.getByRole('button', { name: /^All$/ })
    await allBtn.click()
    await expect(page.getByText('Life Journey').first()).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
test.describe('Timeline edge cases', () => {
  test('unauthenticated request returns 401', async () => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { 'x-forwarded-for': uniqueFakeIp() },
    })
    const res = await api.get('/api/timeline')
    expect(res.status()).toBe(401)

    const body = await res.json()
    expect(body.success).toBe(false)

    await api.dispose()
  })

  test('invalid personId is gracefully handled', async ({ user }) => {
    const res = await user.api.get(
      '/api/timeline?personId=nonexistent-person-id-xyz',
    )
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    // Should return an empty or near-empty result — not crash
    expect(body.pagination).toBeTruthy()
  })

  test('large limit is handled correctly', async ({ user }) => {
    const res = await user.api.get('/api/timeline?limit=9999')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.pagination.limit).toBe(9999)
  })

  test('future date range returns no events', async ({ user }) => {
    const futureFrom = '2100-01-01'
    const futureTo = '2100-12-31'

    const res = await user.api.get(
      `/api/timeline?dateFrom=${futureFrom}&dateTo=${futureTo}`,
    )
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.pagination.total).toBe(0)
    expect(body.data).toHaveLength(0)
  })
})
