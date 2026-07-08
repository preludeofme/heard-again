import { test, expect, expectAlert, signUpFreshUser } from './fixtures'

/**
 * Onboarding wizard: family name -> self profile -> family tree.
 *
 * Users here are created via the API but have NOT completed onboarding, which
 * is exactly the state a fresh signup is in.
 */

test.describe('Onboarding', () => {
  test('wizard requires a family name before continuing', async ({ page, context }) => {
    const user = await signUpFreshUser(context)

    await page.goto('/onboarding', { waitUntil: 'networkidle' })
    await expect(page.getByText('What should we call your family story?')).toBeVisible()

    // Step 1 cannot be skipped with an empty family name.
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expectAlert(page, /every story needs a name/i)

    await user.dispose()
  })

  test('wizard requires a first name on the profile step', async ({ page, context }) => {
    const user = await signUpFreshUser(context)

    await page.goto('/onboarding', { waitUntil: 'networkidle' })
    await page.getByLabel('Family Name').fill(user.info.familyName)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    await expect(page.getByText('Tell us about yourself')).toBeVisible()
    // First name is pre-filled from signup — clear it to prove validation.
    await page.getByLabel('First Name').fill('')
    await page.getByRole('button', { name: 'Get Started', exact: true }).click()
    await expectAlert(page, /please enter your first name/i)

    await user.dispose()
  })

  test('completing onboarding creates the self profile and persists @mobile', async ({
    page,
    context,
  }) => {
    const user = await signUpFreshUser(context)

    await page.goto('/onboarding', { waitUntil: 'networkidle' })
    await page.getByLabel('Family Name').fill(user.info.familyName)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    await expect(page.getByText('Tell us about yourself')).toBeVisible()
    await page.getByLabel('First Name').fill(user.info.firstName)
    await page.getByLabel('Last Name (Optional)').fill(user.info.lastName)
    await page.getByRole('button', { name: 'Get Started', exact: true }).click()

    // Wizard hands off to the family tree with the self person in place.
    await expect(page).toHaveURL(/\/family-tree/, { timeout: 45_000 })
    await expect(page.getByText(user.info.displayName, { exact: true }).first()).toBeVisible()

    // Completion persists across a reload...
    await page.reload()
    await expect(page.getByText(user.info.displayName, { exact: true }).first()).toBeVisible()

    // ...and across a fresh login session.
    await user.login()
    const secondSession = await user.api.get('/api/people', {
      params: { search: user.info.lastName, limit: '5' },
    })
    const body = await secondSession.json()
    expect(body.success).toBe(true)
    const self = (body.data || []).find(
      (p: { firstName: string; lastName: string | null }) =>
        p.firstName === user.info.firstName && p.lastName === user.info.lastName,
    )
    expect(self).toBeTruthy()

    await user.dispose()
  })

  test('user who has not onboarded sees the empty family tree state', async ({
    page,
    context,
  }) => {
    const user = await signUpFreshUser(context)

    await page.goto('/family-tree')
    await expect(page.getByText('Begin your family legacy')).toBeVisible()
    await expect(page.getByText('Add Your First Relative')).toBeVisible()

    await user.dispose()
  })
})
