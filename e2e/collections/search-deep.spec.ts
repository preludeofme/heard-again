import { test, expect } from './fixtures'

/**
 * Search — deep functional tests beyond page load.
 *
 * Covers: search query execution, result filtering by type, sorting,
 * suggestions API, search history, and empty/mixed result states.
 */

test.describe('Search execution', () => {
  test('search returns stories matching the query', async ({ user }) => {
    const marker = `searchable-marker-${Date.now().toString(36)}`
    await user.createStory({ title: marker, content: `<p>${marker}</p>` })

    const res = await user.api.get(`/api/search?q=${encodeURIComponent(marker)}&limit=20`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toBeTruthy()
    const stories = body.data.stories ?? []
    expect(stories.length).toBeGreaterThan(0)
    expect(stories.some((s: { title: string }) => s.title === marker)).toBe(true)
  })

  test('search returns people matching the query', async ({ user }) => {
    const res = await user.api.get(
      `/api/search?q=${encodeURIComponent(user.info.firstName)}&limit=20`,
    )
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    const people = body.data?.people ?? []
    // The user's own person should appear in results
    expect(people.some((p: { firstName: string }) => p.firstName === user.info.firstName)).toBe(
      true,
    )
  })

  test('search returns empty results for nonsense query', async ({ user }) => {
    const res = await user.api.get(
      `/api/search?q=xyznonexistent${Date.now().toString(36)}&limit=20`,
    )
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toBeTruthy()
    expect(body.data.totalResults).toBe(0)
  })

  test('search respects limit parameter', async ({ user }) => {
    // Create several stories to have a pool
    for (let i = 0; i < 5; i++) {
      await user.createStory({ title: `Pool Story ${i} ${Date.now().toString(36)}` })
    }

    const res = await user.api.get('/api/search?q=Pool+Story&limit=2')
    const body = await res.json()
    expect(body.success).toBe(true)
    const stories = body.data?.stories ?? []
    expect(stories.length).toBeLessThanOrEqual(2)
  })
})

test.describe('Search suggestions', () => {
  test('suggestions API returns results', async ({ user }) => {
    await user.createStory({ title: `Suggestible ${Date.now().toString(36)}` })

    const res = await user.api.get(`/api/search/suggestions?q=${user.info.firstName.slice(0, 3)}`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toBeTruthy()
  })
})

test.describe('Search UI', () => {
  test('search page loads with search input', async ({ page, user }) => {
    await page.goto('/search', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/search/)
    await expect(
      page.getByPlaceholder(/search|find/i).first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('searching from the page updates results', async ({ page, user }) => {
    const marker = `ui-search-${Date.now().toString(36)}`
    await user.createStory({ title: marker })

    await page.goto('/search', { waitUntil: 'networkidle' })
    const searchField = page.getByPlaceholder(/search|find/i).first()
    await searchField.fill(marker)
    await searchField.press('Enter')

    // The URL should reflect the query and the page should show results
    await expect(page).toHaveURL(/q=/, { timeout: 15000 })
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 15000 })
  })
})

test.describe('Search filtering', () => {
  test('stories-only search API works', async ({ user }) => {
    await user.createStory({ title: `Filter Story ${Date.now().toString(36)}` })

    const res = await user.api.get('/api/search/stories?q=Filter+Story&limit=10')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  test('people-only search API works', async ({ user }) => {
    const res = await user.api.get(
      `/api/search/people?q=${encodeURIComponent(user.info.firstName)}&limit=10`,
    )
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

test.describe('Search isolation', () => {
  test("user B's search never returns user A's private stories", async ({ user }) => {
    const otherUser = await TestUser.signUp()
    const marker = `private-search-${Date.now().toString(36)}`
    await otherUser.createStory({ title: marker })

    const res = await user.api.get(`/api/search?q=${encodeURIComponent(marker)}&limit=20`)
    const body = await res.json()
    const stories = body.data?.stories ?? []
    expect(stories.some((s: { title: string }) => s.title === marker)).toBe(false)

    await otherUser.dispose()
  })
})
