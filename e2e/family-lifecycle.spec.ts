import { test, expect } from '@playwright/test'

/**
 * Critical-path E2E: the full new-user family lifecycle journey.
 *
 * Signup -> onboarding (family name + self profile) -> family tree loads ->
 * add a new family member (with a relationship to self) -> edit that member ->
 * delete that member -> verify removal in both the UI and the API.
 *
 * This is the primary regression guard for "sign up, add family, delete
 * family member" — every step asserts a real, non-optional outcome (no
 * soft/skippable checks) so a broken flow fails the test. Implemented as a
 * single test with `test.step()` sections so the authenticated session
 * (cookies) persists across the whole journey.
 *
 * Prerequisites:
 *   - App running at https://localhost:4777 (or $PLAYWRIGHT_BASE_URL)
 *   - Run: npx playwright test e2e/family-lifecycle.spec.ts
 */

const RUN_ID = Date.now()
const SIGNUP_EMAIL = `e2e-lifecycle-${RUN_ID}@heardagain.com`
const SIGNUP_PASSWORD = 'E2ETestPassword!23'
const FAMILY_NAME = `E2E Family ${RUN_ID}`
const SELF_FIRST = 'Journey'
const SELF_LAST = `Self${RUN_ID}`
const PARENT_FIRST = 'Journey'
const PARENT_LAST = `Parent${RUN_ID}`
const SELF_DISPLAY_NAME = `${SELF_FIRST} ${SELF_LAST}`
const PARENT_DISPLAY_NAME = `${PARENT_FIRST} ${PARENT_LAST}`
const UPDATED_BIO = `Added and edited by the E2E suite at run ${RUN_ID}.`

test.setTimeout(180_000)

test('signup -> onboarding -> add family member -> edit -> delete', async ({ page }) => {
  let newPersonId: string | null = null

  await test.step('sign up a brand-new user', async () => {
    await page.goto('/signup', { waitUntil: 'networkidle' })

    await page.getByLabel(/email|email address/i).fill(SIGNUP_EMAIL)
    await page.getByLabel('Password', { exact: true }).fill(SIGNUP_PASSWORD)
    await page.getByLabel('Confirm Password', { exact: true }).fill(SIGNUP_PASSWORD)
    await page.getByLabel(/first name/i).fill('E2E')
    await page.getByLabel(/last name/i).fill('Signup')
    await page.getByRole('button', { name: 'Create Account', exact: true }).click()

    // A brand-new account must land on onboarding, not stay on signup/login.
    // Generous timeout: Next.js dev mode compiles routes lazily on first hit.
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 45000 })
  })

  await test.step('complete onboarding with a family name and self profile', async () => {
    await expect(page.getByLabel(/family name/i)).toBeVisible({ timeout: 10000 })
    await page.getByLabel(/family name/i).fill(FAMILY_NAME)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    await expect(page.getByText('Tell us about yourself')).toBeVisible({ timeout: 10000 })
    const firstNameField = page.getByLabel(/first name/i)
    await expect(firstNameField).toBeVisible({ timeout: 10000 })
    await firstNameField.fill(SELF_FIRST)
    const lastNameField = page.getByLabel(/last name/i)
    await lastNameField.fill(SELF_LAST)

    await page.getByRole('button', { name: 'Get Started', exact: true }).click()

    await expect(page).toHaveURL(/\/family-tree/, { timeout: 45000 })
  })

  await test.step('family tree loads and shows the self family member', async () => {
    await expect(page.getByText(SELF_DISPLAY_NAME, { exact: true }).first()).toBeVisible({ timeout: 15000 })
  })

  await test.step('add a new family member with a relationship to self', async () => {
    await page.getByText('Add Relative', { exact: true }).click()

    const dialog = page.getByRole('dialog').filter({ hasText: 'Add New Person' })
    await expect(dialog).toBeVisible({ timeout: 10000 })

    await dialog.getByLabel(/first name \*/i).fill(PARENT_FIRST)
    await dialog.getByLabel(/^last name$/i).fill(PARENT_LAST)

    // Link the new person to Self via the quick-relationship picker.
    const relatedToField = dialog.getByLabel('Related To')
    await relatedToField.click()
    const selfOption = page.getByRole('option', { name: new RegExp(SELF_DISPLAY_NAME) })
    await expect(selfOption).toBeVisible({ timeout: 10000 })
    await selfOption.click()

    // The "Relationship" <Select> doesn't wire an aria-labelledby to its
    // InputLabel (unlike the MUI TextField-based fields), so it has no
    // accessible name — scope by its FormControl wrapper instead.
    const relationshipTypeField = dialog
      .locator('.MuiFormControl-root')
      .filter({ hasText: 'Relationship' })
      .getByRole('combobox')
    await relationshipTypeField.click()
    await page.getByRole('option', { name: /is parent of selected person/i }).click()

    await dialog.getByRole('button', { name: 'Add to Family Tree', exact: true }).click()

    // Success modal confirms the create+relationship flow completed.
    const successDialog = page.getByRole('dialog').filter({ hasText: 'Person Created Successfully!' })
    await expect(successDialog).toBeVisible({ timeout: 15000 })
    await successDialog.getByRole('button', { name: 'OK', exact: true }).click()
    await expect(successDialog).not.toBeVisible({ timeout: 10000 })

    // New person now renders in the tree.
    await expect(page.getByText(PARENT_DISPLAY_NAME, { exact: true }).first()).toBeVisible({ timeout: 15000 })

    // Capture the new person's id via the API for later hard-verification.
    const peopleData = await page.evaluate(async (search) => {
      const res = await fetch(`/api/people?search=${encodeURIComponent(search)}&limit=10`, { credentials: 'include' })
      return res.json()
    }, PARENT_LAST)
    expect(peopleData.success).toBe(true)
    const created = (peopleData.data || []).find((p: any) => p.firstName === PARENT_FIRST && p.lastName === PARENT_LAST)
    expect(created).toBeTruthy()
    newPersonId = created.id
  })

  await test.step('edit the newly created family member', async () => {
    await page.getByText(PARENT_DISPLAY_NAME, { exact: true }).first().click()

    const personDialog = page.getByRole('dialog').filter({ hasText: PARENT_DISPLAY_NAME })
    await expect(personDialog).toBeVisible({ timeout: 10000 })

    await personDialog.getByRole('button', { name: 'Edit Person', exact: true }).click()

    const bioField = personDialog.getByPlaceholder('Write a brief biography...')
    await expect(bioField).toBeVisible()
    await bioField.fill(UPDATED_BIO)

    await personDialog.getByRole('button', { name: 'Save Changes', exact: true }).click()

    // Editing mode exits and the updated bio is now shown on the overview tab.
    await expect(personDialog.getByRole('button', { name: 'Edit Person', exact: true })).toBeVisible({ timeout: 10000 })
    await expect(personDialog.getByText(UPDATED_BIO)).toBeVisible()

    // Close via Escape — MUI Dialog wires this to onClose, and editing mode
    // has already been exited so no "discard changes" confirmation appears.
    await page.keyboard.press('Escape')
    await expect(personDialog).not.toBeVisible({ timeout: 10000 })
  })

  await test.step('delete the family member and confirm removal', async () => {
    await page.getByText(PARENT_DISPLAY_NAME, { exact: true }).first().click()

    const personDialog = page.getByRole('dialog').filter({ hasText: PARENT_DISPLAY_NAME })
    await expect(personDialog).toBeVisible({ timeout: 10000 })

    await personDialog.getByRole('button', { name: 'Edit Person', exact: true }).click()
    await personDialog.getByRole('button', { name: 'Delete', exact: true }).click()

    const confirmDialog = page.getByRole('dialog').filter({ hasText: 'Delete Family Member?' })
    await expect(confirmDialog).toBeVisible({ timeout: 10000 })
    await confirmDialog.getByRole('button', { name: 'Delete Permanently', exact: true }).click()

    // Modal closes and the deleted member no longer appears anywhere in the tree.
    await expect(personDialog).not.toBeVisible({ timeout: 15000 })
    await expect(page.getByText(PARENT_DISPLAY_NAME, { exact: true })).toHaveCount(0, { timeout: 15000 })

    // Self remains — only the added member was removed.
    await expect(page.getByText(SELF_DISPLAY_NAME, { exact: true }).first()).toBeVisible()

    // Hard verification against the API: the person record is actually gone.
    expect(newPersonId).toBeTruthy()
    const getResult = await page.request.get(`/api/people/${newPersonId}`)
    expect(getResult.status()).toBe(404)
  })
})
