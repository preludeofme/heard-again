import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

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

/**
 * Clicks a person's card on the tree canvas by name.
 *
 * Once a person has been clicked at least once, the header nav's "Currently
 * Viewing" switcher also renders their name — so a page-wide `getByText`
 * becomes ambiguous (and the header entry, being first in DOM order, wins
 * over the tree card, opening the family-switcher overlay instead of the
 * person detail modal). Scoping to the React Flow canvas (`role="application"`)
 * avoids that collision.
 */
async function clickTreeNode(page: Page, displayName: string) {
  await page
    .getByRole('application')
    .getByText(displayName, { exact: true })
    .first()
    .click()
}

/**
 * Opens the PersonDetailModal for a person and returns its dialog locator.
 *
 * The first click on a node also switches the app-wide "Currently Viewing"
 * member, which re-renders the tree — occasionally swallowing the modal that
 * the same click opened. Retry the click if the dialog doesn't materialise.
 */
async function openPersonDetail(page: Page, displayName: string) {
  const dialog = page.getByRole('dialog').filter({ hasText: displayName })
  for (let attempt = 0; attempt < 2; attempt++) {
    await clickTreeNode(page, displayName)
    const appeared = await dialog
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false)
    if (appeared) return dialog
    await page.keyboard.press('Escape').catch(() => {})
  }
  await clickTreeNode(page, displayName)
  await expect(dialog).toBeVisible({ timeout: 10000 })
  return dialog
}

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

    // The canvas doesn't auto re-fit the viewport for nodes added after the
    // initial mount (React Flow's `fitView` only runs once, and off-screen
    // nodes aren't rendered at all while virtualized) — reload so the tree
    // re-mounts and fits around the now-larger node set, same as a real user
    // refreshing the page.
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByText(SELF_DISPLAY_NAME, { exact: true }).first()).toBeVisible({ timeout: 15000 })

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
    // Clicking a tree node opens the read-only PersonDetailModal (Stories /
    // Voices / Relatives / Media tabs, with Edit / Delete / View Full Profile
    // actions) — not the same component as the create dialog.
    const detailDialog = await openPersonDetail(page, PARENT_DISPLAY_NAME)

    // "Edit" hands off to the same Add/Edit form used for creation, now in edit mode.
    await detailDialog.getByRole('button', { name: 'Edit', exact: true }).click()

    const editDialog = page.getByRole('dialog').filter({ hasText: 'Edit Person' })
    await expect(editDialog).toBeVisible({ timeout: 10000 })

    // Biography lives inside the collapsed "Advanced Options" accordion.
    await editDialog.getByText('Advanced Options (Dates, Details, Bio)', { exact: true }).click()
    const bioField = editDialog.getByLabel('Biography', { exact: true })
    await expect(bioField).toBeVisible({ timeout: 10000 })
    await bioField.fill(UPDATED_BIO)

    await editDialog.getByRole('button', { name: 'Save Changes', exact: true }).click()
    await expect(editDialog).not.toBeVisible({ timeout: 10000 })

    // Re-open the detail modal and confirm the bio persisted.
    const detailDialogAfterEdit = await openPersonDetail(page, PARENT_DISPLAY_NAME)
    await expect(detailDialogAfterEdit.getByText(UPDATED_BIO)).toBeVisible({ timeout: 10000 })

    await page.keyboard.press('Escape')
    await expect(detailDialogAfterEdit).not.toBeVisible({ timeout: 10000 })
  })

  await test.step('delete the family member and confirm removal', async () => {
    const detailDialog = await openPersonDetail(page, PARENT_DISPLAY_NAME)

    await detailDialog.getByRole('button', { name: 'Delete', exact: true }).click()

    // PersonDetailModal's own confirmation ("Delete Family Member?").
    const firstConfirm = page.getByRole('dialog').filter({ hasText: 'Delete Family Member?' })
    await expect(firstConfirm).toBeVisible({ timeout: 10000 })
    await firstConfirm.getByRole('button', { name: 'Delete Permanently', exact: true }).click()

    // FamilyTreePage renders a second, independent confirmation ("Delete
    // Person") on top of the first — a double-confirm UX quirk from two
    // separate delete flows both being wired up. Documented in
    // .claude/memory/bugs.md; not this suite's job to fix, just to survive.
    const secondConfirm = page.getByRole('dialog').filter({ hasText: 'Delete Person' })
    await expect(secondConfirm).toBeVisible({ timeout: 10000 })

    // Confirming triggers `window.location.reload()` — wait for the reload
    // to finish loading before asserting on the post-delete page state.
    await Promise.all([
      page.waitForLoadState('load', { timeout: 20000 }),
      secondConfirm.getByRole('button', { name: 'Delete', exact: true }).click(),
    ])

    await expect(page.getByText(SELF_DISPLAY_NAME, { exact: true }).first()).toBeVisible({ timeout: 15000 })

    // The deleted member no longer appears anywhere in the tree.
    await expect(page.getByRole('application').getByText(PARENT_DISPLAY_NAME, { exact: true })).toHaveCount(0, { timeout: 15000 })

    // Hard verification against the API: the person record is actually gone.
    // Bypass HTTP caching explicitly — the browser has cached earlier 200
    // responses for this exact URL from the pre-delete detail-modal fetches.
    expect(newPersonId).toBeTruthy()
    const getResult = await page.request.get(`/api/people/${newPersonId}`, {
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    })
    expect(getResult.status()).toBe(404)
  })
})
