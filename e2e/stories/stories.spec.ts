import { test, expect } from './fixtures'

/**
 * Stories / memories: create (UI), read, update, delete, validation, data
 * integrity (special characters, long content), and empty state.
 */

test.describe('Story creation', () => {
  test('user can write and submit a story about themselves @mobile', async ({ page, user }) => {
    const storyTitle = `The Old Oak Tree ${Date.now().toString(36)}`
    const storyText = 'We used to climb the old oak tree behind the house every summer.'

    await page.goto(`/stories/contribute?subjectId=${user.personId}`)
    await expect(page.getByText(`Tell a story about ${user.info.firstName}`)).toBeVisible()

    await page.getByRole('combobox', { name: 'Your Relationship' }).click()
    await page.getByRole('option', { name: 'Self', exact: true }).click()

    await page.getByLabel('Story Title (Optional)').fill(storyTitle)
    await page.locator('[contenteditable="true"]').first().fill(storyText)

    const submit = page.getByRole('button', { name: 'Submit Story', exact: true })
    await expect(submit).toBeEnabled()
    await submit.click()

    await expect(page.getByText('Thank you!')).toBeVisible()

    // The story is really persisted and attached to the right person.
    const res = await user.api.get('/api/stories')
    const body = await res.json()
    expect(body.success).toBe(true)
    const stories = body.data?.stories ?? body.data ?? []
    const created = (Array.isArray(stories) ? stories : []).find(
      (s: { title: string }) => s.title === storyTitle,
    )
    expect(created).toBeTruthy()
  })

  test('story cannot be submitted without content', async ({ page, user }) => {
    await page.goto(`/stories/contribute?subjectId=${user.personId}`)
    await expect(page.getByText(`Tell a story about ${user.info.firstName}`)).toBeVisible()

    await expect(page.getByRole('button', { name: 'Submit Story', exact: true })).toBeDisabled()
  })

  test('created story appears in the stories lens', async ({ page, user }) => {
    const marker = `unmistakable-lens-marker-${Date.now().toString(36)}`
    await user.createStory({ content: `<p>The ${marker} memory.</p>` })

    await page.goto('/legacy?lens=stories')
    await expect(page.getByText(new RegExp(marker)).first()).toBeVisible()
  })
})

test.describe('Story viewing', () => {
  test('story detail shows the full story @mobile', async ({ page, user }) => {
    const title = `Detail View Story ${Date.now().toString(36)}`
    const { id } = await user.createStory({
      title,
      content: '<p>First paragraph of the memory.</p><p>Second paragraph, equally treasured.</p>',
    })

    await page.goto(`/stories/${id}`)
    await expect(page.getByText(title).first()).toBeVisible()
    await expect(page.getByText('First paragraph of the memory.')).toBeVisible()
    await expect(page.getByText('Second paragraph, equally treasured.')).toBeVisible()
  })

  test('special characters, quotes, and paragraphs are preserved', async ({ page, user }) => {
    const line1 = `He said, "don't ever sell Grandma's piano" — & we never did.`
    const line2 = 'Ampersands & <angle brackets> survive too: 100% intact.'
    const { id } = await user.createStory({
      title: `Special Chars ${Date.now().toString(36)}`,
      content: `<p>${line1.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p><p>${line2
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</p>`,
    })

    await page.goto(`/stories/${id}`)
    await expect(page.getByText(line1)).toBeVisible()
    await expect(page.getByText(line2)).toBeVisible()
  })

  test('very long content renders fully', async ({ page, user }) => {
    const opening = 'It began on a cold morning in 1962.'
    const closing = 'And that, finally, is the whole story.'
    const filler = Array.from(
      { length: 60 },
      (_, i) => `<p>Paragraph ${i + 1}: the family gathered again, as they always did.</p>`,
    ).join('')
    const { id } = await user.createStory({
      title: `Long Story ${Date.now().toString(36)}`,
      content: `<p>${opening}</p>${filler}<p>${closing}</p>`,
    })

    await page.goto(`/stories/${id}`)
    await expect(page.getByText(opening)).toBeVisible()
    await expect(page.getByText(closing)).toBeVisible()
  })
})

test.describe('Story editing', () => {
  test('user can edit a story title and content', async ({ page, user }) => {
    const { id } = await user.createStory({
      title: 'Original Title',
      content: '<p>Original content before the edit.</p>',
    })
    const newTitle = `Rewritten Title ${Date.now().toString(36)}`
    const newText = 'Completely rewritten content after the edit.'

    await page.goto(`/stories/${id}/edit`)
    const titleField = page.getByLabel('Title', { exact: true })
    await expect(titleField).toHaveValue('Original Title')
    await titleField.fill(newTitle)
    await page.locator('[contenteditable="true"]').first().fill(newText)
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click()

    // Saving returns to the detail page with the new content.
    await expect(page).toHaveURL(new RegExp(`/stories/${id}$`))
    await expect(page.getByText(newTitle).first()).toBeVisible()
    await expect(page.getByText(newText)).toBeVisible()
  })

  test('edit validation rejects an empty title', async ({ page, user }) => {
    const { id } = await user.createStory({ title: 'Will Try To Blank' })

    await page.goto(`/stories/${id}/edit`)
    await page.getByLabel('Title', { exact: true }).fill('')
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click()

    await expect(page.getByText(/title and story content are required/i)).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/stories/${id}/edit`))
  })
})

test.describe('Story deletion', () => {
  test('user can delete a story after confirming', async ({ page, user }) => {
    const { id } = await user.createStory({ title: `Doomed Story ${Date.now().toString(36)}` })

    await page.goto(`/stories/${id}/edit`)
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    const confirm = page.getByRole('dialog').filter({ hasText: 'Delete Story?' })
    await expect(confirm).toBeVisible()
    await expect(confirm.getByText(/cannot be undone/i)).toBeVisible()
    await confirm.getByRole('button', { name: 'Delete Story', exact: true }).click()

    // Deletion navigates away and the record is really gone.
    await expect(page).not.toHaveURL(new RegExp(`/stories/${id}/edit`), { timeout: 30_000 })
    await expect
      .poll(async () => (await user.api.get(`/api/stories/${id}`)).status(), { timeout: 15_000 })
      .toBe(404)
  })
})

test.describe('Stories empty state', () => {
  test('a family with no stories sees the first-story prompt', async ({ page, user }) => {
    await page.goto('/legacy?lens=stories')
    await expect(page.getByText(/story starts here|moment that matters/i).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /share the first memory/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /add a story/i })).toBeVisible()
  })
})
