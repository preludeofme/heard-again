import { test, expect } from './fixtures'

/**
 * Navigation and layout: desktop top nav, memories lens switching, user menu,
 * and the mobile bottom navigation for the same core destinations.
 */

test.describe('Desktop navigation', () => {
  test('top navigation moves between the main areas', async ({ page, user }) => {
    await page.goto('/legacy')
    await expect(page.getByText(user.info.familyName)).toBeVisible()

    // Generous timeouts: dev mode compiles each destination on first hit.
    await page.getByRole('link', { name: 'Family Tree', exact: true }).click()
    await expect(page).toHaveURL(/\/family-tree/, { timeout: 30_000 })

    await page.getByRole('link', { name: 'Contribute', exact: true }).click()
    await expect(page).toHaveURL(/\/contribute/, { timeout: 30_000 })

    await page.getByRole('link', { name: 'Family Legacy', exact: true }).click()
    await expect(page).toHaveURL(/\/legacy/, { timeout: 30_000 })
  })

  test('memories lenses switch and stay deep-linkable', async ({ page, user }) => {
    await page.goto('/legacy')
    // The shell normalises the URL to the default lens.
    await expect(page).toHaveURL(/lens=journey/)

    await page.getByRole('button', { name: 'Stories', exact: true }).click()
    await expect(page).toHaveURL(/lens=stories/)

    await page.getByRole('button', { name: 'Voices', exact: true }).click()
    await expect(page).toHaveURL(/lens=voices/)

    await page.getByRole('button', { name: 'Keepsakes', exact: true }).click()
    await expect(page).toHaveURL(/lens=keepsakes/)

    // Deep link straight into a lens after a reload.
    await page.reload()
    await expect(page).toHaveURL(/lens=keepsakes/)
  })

  test('user menu links to account settings', async ({ page, user }) => {
    await page.goto('/legacy')
    await page.getByRole('button', { name: 'Open user menu' }).click()
    await expect(page.getByRole('menuitem', { name: user.info.displayName })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Account', exact: true }).click()
    await expect(page).toHaveURL(/\/account/)
  })

  test('legacy routes redirect into the memories shell', async ({ page, user }) => {
    await page.goto('/stories')
    await expect(page).toHaveURL(/\/legacy\?.*lens=stories/)

    await page.goto('/voice-lab')
    await expect(page).toHaveURL(/\/legacy\?.*lens=voices/)
  })
})

test.describe('Mobile navigation', () => {
  test('bottom navigation reaches the core areas @mobile @mobile-only', async ({
    page,
    user,
  }) => {
    await page.goto('/legacy')
    await expect(page.getByText(user.info.familyName)).toBeVisible()

    const bottomNav = page.locator('.MuiBottomNavigation-root')
    await expect(bottomNav).toBeVisible()

    // The Next.js dev-tools launcher floats over the bottom edge in dev mode
    // and can swallow taps (dev-only artifact) — drop it before each tap.
    const tap = async (name: string, url: RegExp) => {
      await page.evaluate(() => document.querySelector('nextjs-portal')?.remove())
      await bottomNav.getByRole('button', { name }).click()
      await expect(page).toHaveURL(url, { timeout: 30_000 })
    }

    await tap('Tree', /\/family-tree/)
    await tap('Contribute', /\/contribute/)
    await tap('Legacy', /\/legacy/)
  })
})

test.describe('Back / return behaviour', () => {
  test('story detail back control returns to the stories list', async ({ page, user }) => {
    const { id } = await user.createStory({ title: `Back Nav Story ${Date.now().toString(36)}` })

    await page.goto(`/stories/${id}`)
    await expect(page.getByText('Back Nav Story', { exact: false }).first()).toBeVisible({
      timeout: 30_000,
    })

    // The detail page's back arrow returns to the stories overview.
    await page.locator('button:has([data-testid="ArrowBackIcon"])').first().click()
    await expect(page).toHaveURL(/\/legacy\?.*lens=stories|\/stories/)
  })
})
