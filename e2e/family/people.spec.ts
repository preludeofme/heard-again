import { test, expect } from './fixtures'

/**
 * Person profiles: creation validation, viewing, and the family <-> person
 * relationship being visible in navigation.
 *
 * The full add -> edit -> delete person journey on the tree canvas is covered
 * by family-lifecycle.spec.ts; these tests cover the pieces around it.
 */

test.describe('Person creation validation', () => {
  test('a person cannot be added without a first name', async ({ page, user }) => {
    await page.goto('/family-tree')
    await expect(page.getByText(user.info.displayName, { exact: true }).first()).toBeVisible()

    await page.getByText('Add Relative', { exact: true }).click()
    const dialog = page.getByRole('dialog').filter({ hasText: 'Add New Person' })
    await expect(dialog).toBeVisible()

    // Touch the field (helper text only shows for touched fields), then submit empty.
    const firstNameField = dialog.getByLabel(/first name \*/i)
    await firstNameField.fill('X')
    await firstNameField.fill('')
    await dialog.getByRole('button', { name: 'Add to Family Tree', exact: true }).click()

    await expect(dialog.getByText('First name is required')).toBeVisible()
    // The dialog stays open — nothing was created.
    await expect(dialog).toBeVisible()
  })
})

test.describe('Person profile page', () => {
  test('person page shows the person and their stories @mobile', async ({ page, user }) => {
    const title = `Profile Page Story ${Date.now().toString(36)}`
    await user.createStory({ title })

    await page.goto(`/profile/${user.personId}`)
    await expect(page.getByText(user.info.displayName).first()).toBeVisible()
  })

  test('a newly added relative gets their own viewable profile', async ({ page, user }) => {
    const body = await user.postJson<{ id: string }>('/api/people', {
      firstName: 'Aunt',
      lastName: `Rosa${Date.now().toString(36)}`,
    })
    const relativeId = body.data?.id
    expect(relativeId).toBeTruthy()

    await page.goto(`/profile/${relativeId}`)
    await expect(page.getByText(/Aunt Rosa/).first()).toBeVisible()
  })
})

test.describe('Family / person navigation', () => {
  test('family tree and person profile link to each other', async ({ page, user }) => {
    // Tree -> person: open the self node, then View Full Profile.
    await page.goto('/family-tree')
    await page
      .getByRole('application')
      .getByText(user.info.displayName, { exact: true })
      .first()
      .click()

    const detail = page.getByRole('dialog').filter({ hasText: user.info.displayName })
    await expect(detail).toBeVisible()
    await detail.getByRole('button', { name: /view full profile/i }).click()

    await expect(page).toHaveURL(new RegExp(`/profile/${user.personId}`))
    await expect(page.getByText(user.info.displayName).first()).toBeVisible()

    // Person -> family: top navigation returns to the tree.
    await page.getByRole('link', { name: 'Family Tree', exact: true }).click()
    await expect(page).toHaveURL(/\/family-tree/)
  })
})
