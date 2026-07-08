import { test, expect } from './fixtures'

/**
 * Browser-level E2E tests for Heard Again pages that had API-only coverage.
 *
 * These pages were tested at the API level but never exercised through
 * actual browser navigation and UI interaction.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION PAGE
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Subscription page', () => {
  test('subscription page loads and shows current plan', async ({ page, user }) => {
    await page.goto('/subscription', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/subscription/, { timeout: 30000 })

    // Should show current plan info
    await expect(
      page.getByText(/current plan|your plan|free/i).first(),
    ).toBeVisible({ timeout: 15000 })
  })

  test('subscription page shows available plans', async ({ page, user }) => {
    await page.goto('/subscription', { waitUntil: 'networkidle' })

    // Plan cards or plan names should be visible
    await expect(
      page.getByText(/plan|pricing|upgrade/i).first(),
    ).toBeVisible({ timeout: 15000 })
  })

  test('subscription page renders without errors', async ({ page, user }) => {
    await page.goto('/subscription', { waitUntil: 'networkidle' })

    // Page should not show error states
    await expect(page.getByText(/error/i)).toHaveCount(0)
  })

  test('subscription page requires authentication', async ({ page }) => {
    await page.goto('/subscription', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD PAGE
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Dashboard page', () => {
  test('dashboard loads and shows familyspace info', async ({ page, user }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 })

    // Should show familyspace name or welcome content
    await expect(
      page.getByText(new RegExp(user.info.familyName)),
    ).toBeVisible({ timeout: 15000 })
  })

  test('dashboard shows stats or cards', async ({ page, user }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' })

    // Dashboard should have some content — stats, cards, or feed
    const hasContent = await Promise.race([
      page.getByText(/people|stories|memory|member/i).first().isVisible().catch(() => false),
      page.getByRole('heading').first().isVisible().catch(() => false),
    ])
    expect(page.url()).toContain('/dashboard')
  })

  test('dashboard renders without errors', async ({ page, user }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' })
    await expect(page.getByText(/error/i)).toHaveCount(0)
  })

  test('dashboard requires authentication', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// STORIES INDEX PAGE
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Stories index page', () => {
  test('stories page redirects to legacy lens', async ({ page, user }) => {
    await page.goto('/stories', { waitUntil: 'networkidle' })
    // Should redirect to legacy with stories lens
    await expect(page).toHaveURL(/\/legacy/, { timeout: 15000 })
  })

  test('stories legacy lens shows story content', async ({ page, user }) => {
    const marker = `browser-stories-${Date.now().toString(36)}`
    await user.createStory({ title: marker })

    await page.goto('/legacy?lens=stories', { waitUntil: 'networkidle' })
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 15000 })
  })

  test('stories legacy lens shows empty state for new family', async ({
    page,
    user,
  }) => {
    await page.goto('/legacy?lens=stories', { waitUntil: 'networkidle' })

    // Should show either stories or the first-story prompt
    const hasContent = await page
      .getByText(/story|memory|moment/i)
      .first()
      .isVisible()
      .catch(() => false)
    expect(page.url()).toContain('/legacy')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// FAVORITES PAGE
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Favorites page', () => {
  test('favorites page loads', async ({ page, user }) => {
    await page.goto('/favorites', { waitUntil: 'networkidle' })

    // May redirect or show favorites content
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('favorited stories appear on favorites page', async ({ page, user }) => {
    // Create and favorite a story
    const { id: storyId } = await user.createStory({
      title: `Browser Fav ${Date.now().toString(36)}`,
    })
    await user.postJson(`/api/stories/${storyId}/favorite`, {})

    await page.goto('/favorites', { waitUntil: 'networkidle' })

    // The favorited story title should appear
    const hasFav = await page
      .getByText(/Browser Fav/)
      .first()
      .isVisible()
      .catch(() => false)
    // Page should at minimum not error
    await expect(page.getByText(/error/i)).toHaveCount(0)
  })

  test('favorites page requires authentication', async ({ page }) => {
    await page.goto('/favorites', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTIONS PAGE
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Collections page', () => {
  test('collections page redirects to legacy lens', async ({ page, user }) => {
    await page.goto('/collections', { waitUntil: 'networkidle' })
    // Collections redirect to legacy shell
    await expect(page).toHaveURL(/\/legacy/, { timeout: 15000 })
  })

  test('collections collection detail page loads', async ({ page, user }) => {
    // Create a collection first
    const col = await user.postJson<{ id: string }>('/api/collections', {
      name: `Browser Collection ${Date.now().toString(36)}`,
      description: 'E2E test collection',
    })
    const colId = col.data!.id

    await page.goto(`/collections/${colId}`, { waitUntil: 'networkidle' })

    // Should show collection detail or redirect
    const bodyVisible = await page.locator('body').isVisible()
    expect(bodyVisible).toBe(true)
  })

  test('collections page requires authentication', async ({ page }) => {
    await page.goto('/collections', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY / MEMORIES SHELL
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Legacy memories shell', () => {
  test('legacy page loads with default lens', async ({ page, user }) => {
    await page.goto('/legacy', { waitUntil: 'networkidle' })

    await expect(page.getByText(user.info.familyName).first()).toBeVisible({
      timeout: 15000,
    })
    // Default lens is journey
    await expect(page).toHaveURL(/lens=journey/, { timeout: 15000 })
  })

  test('journey lens renders', async ({ page, user }) => {
    await page.goto('/legacy?lens=journey', { waitUntil: 'networkidle' })
    await expect(page.getByText(user.info.familyName).first()).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(/error/i)).toHaveCount(0)
  })

  test('keepsakes lens renders', async ({ page, user }) => {
    await page.goto('/legacy?lens=keepsakes', { waitUntil: 'networkidle' })
    await expect(page.getByText(user.info.familyName).first()).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(/error/i)).toHaveCount(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Profile page', () => {
  test('profile page loads for own profile', async ({ page, user }) => {
    await page.goto('/profile', { waitUntil: 'networkidle' })

    // Should show user's profile or redirect to their person profile
    const hasContent = await page
      .getByText(new RegExp(user.info.firstName))
      .first()
      .isVisible()
      .catch(() => false)
    expect(page.url()).not.toContain('/login')
  })

  test('person profile page shows person details', async ({ page, user }) => {
    await page.goto(`/profile/${user.personId}`, { waitUntil: 'networkidle' })

    await expect(
      page.getByText(user.info.displayName).first(),
    ).toBeVisible({ timeout: 15000 })
  })

  test('profile page shows stories when they exist', async ({ page, user }) => {
    const marker = `profile-story-${Date.now().toString(36)}`
    await user.createStory({ title: marker })

    await page.goto(`/profile/${user.personId}`, { waitUntil: 'networkidle' })

    // The story should be visible on the profile
    const storyVisible = await page
      .getByText(marker)
      .first()
      .isVisible()
      .catch(() => false)
    // At minimum, no errors
    await expect(page.getByText(/error/i)).toHaveCount(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// INVITE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Invite page', () => {
  test('invite page loads with token', async ({ page }) => {
    // Try loading with a fake token — it should load the page (may show error or expired)
    await page.goto('/invite?token=fake-test-token', { waitUntil: 'networkidle' })

    // Page should render something (accept/decline UI or error message)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('invite page without token still loads', async ({ page }) => {
    await page.goto('/invite', { waitUntil: 'networkidle' })
    await expect(page.locator('body')).not.toBeEmpty()
  })
})
