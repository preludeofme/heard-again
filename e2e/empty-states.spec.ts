import { test, expect } from './fixtures'

/**
 * Empty, loading, and error states for a brand-new family.
 */

test.describe('New family empty states', () => {
  test('legacy home reflects a brand-new family', async ({ page, user }) => {
    await page.goto('/legacy')
    await expect(page.getByText(user.info.familyName).first()).toBeVisible()
    // One family member (self), no stories yet.
    await expect(page.getByText('Family Members', { exact: false })).toBeVisible()
    await expect(page.getByText('Stories', { exact: false }).first()).toBeVisible()
  })

  test('stories lens shows the no-stories prompt', async ({ page, user }) => {
    await page.goto('/legacy?lens=stories')
    await expect(page.getByText(/first story you share|moment that matters/i)).toBeVisible()
  })

  test('family tree with only the self member offers to add relatives', async ({
    page,
    user,
  }) => {
    await page.goto('/family-tree')
    await expect(page.getByText(user.info.displayName, { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Add Relative', { exact: true })).toBeVisible()
  })

  test('keepsakes and voices lenses render without content', async ({ page, user }) => {
    await page.goto('/legacy?lens=keepsakes')
    await expect(page).toHaveURL(/lens=keepsakes/)
    await expect(page.getByText(user.info.familyName).first()).toBeVisible()

    await page.goto('/legacy?lens=voices')
    await expect(page).toHaveURL(/lens=voices/)
    await expect(page.getByText(user.info.familyName).first()).toBeVisible()
  })
})

test.describe('Error states', () => {
  test('stories lens surfaces a retryable error when the API fails', async ({ page, user }) => {
    // Simulate a server failure for the stories fetch only.
    await page.route('**/api/stories**', (route) => route.abort())

    await page.goto('/legacy?lens=stories')
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible({
      timeout: 30_000,
    })

    // Recovery: let the request through and retry.
    await page.unroute('**/api/stories**')
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(page.getByText(/first story you share|moment that matters/i)).toBeVisible()
  })
})
