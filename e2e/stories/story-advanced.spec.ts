import { test, expect, TestUser } from './fixtures'

/**
 * Story advanced — publish / archive lifecycle, AI rewrite, transcribe,
 * narration management, and cross-tenancy isolation for story-state endpoints.
 *
 * TTS-dependent endpoints (transcribe, generate-audio, save-narration) skip
 * when AUDIO_GENERATION_ENABLED !== 'true'. LLM-dependent rewrite skips when
 * NARRATION_REWRITE_ENABLED === 'false'.
 */

test.describe('Publish / unpublish lifecycle', () => {
  test('user can publish a draft story', async ({ user }) => {
    // Create a draft story
    const { id: storyId } = await user.createStory({ status: 'DRAFT' })

    const pubRes = await user.postRaw(`/api/stories/${storyId}/publish`, {})
    expect(pubRes.status()).toBe(200)

    const pubBody = await pubRes.json()
    expect(pubBody.success).toBe(true)
    expect(pubBody.data.status).toBe('PUBLISHED')

    // Verify it's really published via GET
    const getRes = await user.api.get(`/api/stories/${storyId}`)
    const getBody = await getRes.json()
    expect(getBody.data?.status).toBe('PUBLISHED')
  })

  test('user can unpublish a published story', async ({ user }) => {
    const { id: storyId } = await user.createStory({ status: 'PUBLISHED' })

    // "Unpublish" is just re-creating as DRAFT — the publish endpoint sets
    // status to PUBLISHED unconditionally. To unpublish, update status to DRAFT.
    const updateRes = await user.putRaw(`/api/stories/${storyId}`, { status: 'DRAFT' })
    expect(updateRes.ok()).toBe(true)

    const getRes = await user.api.get(`/api/stories/${storyId}`)
    const getBody = await getRes.json()
    expect(getBody.data?.status).toBe('DRAFT')
  })

  test('publishing an already-published story is idempotent', async ({ user }) => {
    const { id: storyId } = await user.createStory({ status: 'PUBLISHED' })

    const pubRes = await user.postRaw(`/api/stories/${storyId}/publish`, {})
    expect(pubRes.status()).toBe(200)

    const pubBody = await pubRes.json()
    expect(pubBody.success).toBe(true)
    expect(pubBody.data.status).toBe('PUBLISHED')
  })

  test('publishing a non-existent story returns 404', async ({ user }) => {
    const res = await user.postRaw('/api/stories/nonexistent-id-9999/publish', {})
    expect(res.status()).toBe(404)
  })
})

test.describe('Archive lifecycle', () => {
  test('user can archive a story', async ({ user }) => {
    const { id: storyId } = await user.createStory({ status: 'PUBLISHED' })

    const archiveRes = await user.postRaw(`/api/stories/${storyId}/archive`, {})
    expect(archiveRes.status()).toBe(200)

    const archiveBody = await archiveRes.json()
    expect(archiveBody.success).toBe(true)
    expect(archiveBody.data.status).toBe('ARCHIVED')

    // Verify it's really archived via GET
    const getRes = await user.api.get(`/api/stories/${storyId}`)
    const getBody = await getRes.json()
    expect(getBody.data?.status).toBe('ARCHIVED')
  })

  test('archiving an already-archived story is idempotent', async ({ user }) => {
    const { id: storyId } = await user.createStory({ status: 'ARCHIVED' })

    const archiveRes = await user.postRaw(`/api/stories/${storyId}/archive`, {})
    expect(archiveRes.status()).toBe(200)

    const archiveBody = await archiveRes.json()
    expect(archiveBody.success).toBe(true)
    expect(archiveBody.data.status).toBe('ARCHIVED')
  })

  test('archived story is hidden from default story list', async ({ user }) => {
    const title = `Hidden Archived ${Date.now().toString(36)}`
    const { id: storyId } = await user.createStory({ title, status: 'PUBLISHED' })

    // Archive it
    await user.postRaw(`/api/stories/${storyId}/archive`, {})

    // Default list should not include archived stories
    const listRes = await user.api.get('/api/stories')
    const listBody = await listRes.json()
    const stories = listBody.data?.stories ?? listBody.data ?? []
    const found = stories.find((s: { id: string }) => s.id === storyId)
    expect(found).toBeUndefined()
  })

  test('archiving a non-existent story returns 404', async ({ user }) => {
    const res = await user.postRaw('/api/stories/nonexistent-id-9999/archive', {})
    expect(res.status()).toBe(404)
  })
})

test.describe('Cross-tenancy story state', () => {
  let alice: TestUser
  let bob: TestUser
  let aliceStoryId: string

  test.beforeAll(async () => {
    alice = await TestUser.signUp()
    bob = await TestUser.signUp()
    aliceStoryId = (await alice.createStory({ title: 'Alice Private Story' })).id
  })

  test.afterAll(async () => {
    await alice.dispose()
    await bob.dispose()
  })

  test("user B cannot publish user A's story", async () => {
    const res = await bob.postRaw(`/api/stories/${aliceStoryId}/publish`, {})
    expect(res.status()).toBe(404)
  })

  test("user B cannot archive user A's story", async () => {
    const res = await bob.postRaw(`/api/stories/${aliceStoryId}/archive`, {})
    expect(res.status()).toBe(404)
  })

  test("user B cannot rewrite user A's story", async () => {
    // Skip if rewrite is disabled or the LLM call itself could fail.
    if (process.env.NARRATION_REWRITE_ENABLED === 'false') {
      test.skip()
      return
    }

    const res = await bob.postRaw(`/api/stories/${aliceStoryId}/rewrite-first-person`, {})
    // Cross-tenancy should 404 before it ever reaches the LLM.
    expect(res.status()).toBe(404)
  })
})

test.describe('First-person rewrite', () => {
  test.beforeEach(async ({ user }) => {
    await user.login()
  })

  test('rewrite endpoint returns 503 when LLM is disabled', async ({ user }) => {
    // We check environment: if rewrite is disabled, expect 503.
    // If rewrite is enabled, this test verifies it works — but only if env says so.
    const { id: storyId } = await user.createStory()

    const res = await user.postRaw(`/api/stories/${storyId}/rewrite-first-person`, {})

    if (process.env.NARRATION_REWRITE_ENABLED === 'false') {
      expect(res.status()).toBe(503)
      const body = await res.json()
      expect(body.error).toMatch(/not enabled/i)
    } else {
      // LLM is enabled — the rewrite should succeed (200) or fail with a
      // server-side error (502) if the LLM call itself fails, but never 503.
      expect([200, 502]).toContain(res.status())
    }
  })

  test('rewrite endpoint returns 404 for non-existent story', async ({ user }) => {
    const res = await user.postRaw('/api/stories/nonexistent-id-9999/rewrite-first-person', {})
    expect(res.status()).toBe(404)
  })

  test('rewrite endpoint requires EDITOR role', async ({ user }) => {
    // The fixture user has EDITOR by default — verify it succeeds.
    const { id: storyId } = await user.createStory()

    if (process.env.NARRATION_REWRITE_ENABLED === 'false') {
      test.skip()
      return
    }

    const res = await user.postRaw(`/api/stories/${storyId}/rewrite-first-person`, {})
    // 200 = succeeded, 502 = LLM unavailable — both mean auth passed.
    expect([200, 502]).toContain(res.status())
  })
})

test.describe('Transcribe audio story', () => {
  test.beforeEach(async ({ user }) => {
    await user.login()
  })

  test('transcribe endpoint returns 503 when audio generation is disabled', async ({ user }) => {
    if (process.env.AUDIO_GENERATION_ENABLED === 'true') {
      test.skip()
      return
    }

    const { id: storyId } = await user.createStory()

    const res = await user.postRaw(`/api/stories/${storyId}/transcribe`, {})
    expect(res.status()).toBe(503)
  })

  test('transcribe endpoint requires an audio asset', async ({ user }) => {
    if (process.env.AUDIO_GENERATION_ENABLED !== 'true') {
      test.skip()
      return
    }

    // A text story has no audio asset — transcribe should reject.
    const { id: storyId } = await user.createStory()

    const res = await user.postRaw(`/api/stories/${storyId}/transcribe`, {})
    expect(res.status()).toBe(400)

    const body = await res.json()
    expect(body.error).toMatch(/no audio asset/i)
  })

  test('transcribe endpoint returns 404 for non-existent story', async ({ user }) => {
    if (process.env.AUDIO_GENERATION_ENABLED !== 'true') {
      test.skip()
      return
    }

    const res = await user.postRaw('/api/stories/nonexistent-id-9999/transcribe', {})
    expect(res.status()).toBe(404)
  })
})

test.describe('Generate audio narration', () => {
  test.beforeEach(async ({ user }) => {
    await user.login()
  })

  test('generate-audio returns 503 when audio generation is disabled', async ({ user }) => {
    if (process.env.AUDIO_GENERATION_ENABLED === 'true') {
      test.skip()
      return
    }

    const { id: storyId } = await user.createStory()

    const res = await user.postRaw(`/api/stories/${storyId}/generate-audio`, {})
    expect(res.status()).toBe(503)

    const body = await res.json()
    expect(body.error).toMatch(/not yet available/i)
  })

  test('generate-audio requires a voice profile', async ({ user }) => {
    if (process.env.AUDIO_GENERATION_ENABLED !== 'true') {
      test.skip()
      return
    }

    const { id: storyId } = await user.createStory()

    // No voice profile specified and no default for the subject → 400
    const res = await user.postRaw(`/api/stories/${storyId}/generate-audio`, {})
    expect(res.status()).toBe(400)

    const body = await res.json()
    expect(body.error).toMatch(/no voice profile/i)
  })

  test('generate-audio returns 404 for non-existent story', async ({ user }) => {
    if (process.env.AUDIO_GENERATION_ENABLED !== 'true') {
      test.skip()
      return
    }

    const res = await user.postRaw('/api/stories/nonexistent-id-9999/generate-audio', {
      text: 'Hello',
    })
    expect(res.status()).toBe(404)
  })
})

test.describe('Narration data (PATCH / DELETE)', () => {
  test.beforeEach(async ({ user }) => {
    await user.login()
  })

  test('PATCH narration with invalid action returns 400', async ({ user }) => {
    const { id: storyId } = await user.createStory()

    const res = await user.api.patch(`/api/stories/${storyId}/narration`, {
      headers: { 'x-csrf-token': await user.csrf() },
      data: { action: 'invalid-action' },
    })
    expect(res.status()).toBe(400)

    const body = await res.json()
    expect(body.error).toMatch(/invalid action/i)
  })

  test('PATCH narration with empty action returns 400', async ({ user }) => {
    const { id: storyId } = await user.createStory()

    const res = await user.api.patch(`/api/stories/${storyId}/narration`, {
      headers: { 'x-csrf-token': await user.csrf() },
      data: {},
    })
    expect(res.status()).toBe(400)
  })

  test('PATCH narration discard action succeeds', async ({ user }) => {
    const { id: storyId } = await user.createStory()

    const res = await user.api.patch(`/api/stories/${storyId}/narration`, {
      headers: { 'x-csrf-token': await user.csrf() },
      data: { action: 'discard' },
    })
    expect(res.ok()).toBe(true)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.narrationStatus).toBe('NONE')
  })

  test('PATCH narration update with empty narratedContent returns 400', async ({ user }) => {
    const { id: storyId } = await user.createStory()

    const res = await user.api.patch(`/api/stories/${storyId}/narration`, {
      headers: { 'x-csrf-token': await user.csrf() },
      data: { action: 'update', narratedContent: '' },
    })
    expect(res.status()).toBe(400)
  })

  test('PATCH narration update with valid content succeeds', async ({ user }) => {
    const { id: storyId } = await user.createStory()
    const narrationText = 'A rewritten first-person narration of the memory.'

    const res = await user.api.patch(`/api/stories/${storyId}/narration`, {
      headers: { 'x-csrf-token': await user.csrf() },
      data: { action: 'update', narratedContent: narrationText },
    })
    expect(res.ok()).toBe(true)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.narrationStatus).toBe('READY')
    expect(body.data.narratedContent).toBe(narrationText)
  })

  test('PATCH narration approve succeeds', async ({ user }) => {
    // First update with some content, then approve.
    const { id: storyId } = await user.createStory()
    const narrationText = 'An approved first-person narration.'

    await user.api.patch(`/api/stories/${storyId}/narration`, {
      headers: { 'x-csrf-token': await user.csrf() },
      data: { action: 'update', narratedContent: narrationText },
    })

    const res = await user.api.patch(`/api/stories/${storyId}/narration`, {
      headers: { 'x-csrf-token': await user.csrf() },
      data: { action: 'approve' },
    })
    expect(res.ok()).toBe(true)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.narrationStatus).toBe('APPROVED')
    expect(body.data.narrationApprovedAt).toBeTruthy()
  })

  test('PATCH narration returns 404 for non-existent story', async ({ user }) => {
    const res = await user.api.patch('/api/stories/nonexistent-id-9999/narration', {
      headers: { 'x-csrf-token': await user.csrf() },
      data: { action: 'discard' },
    })
    expect(res.status()).toBe(404)
  })

  test('DELETE narration succeeds', async ({ user }) => {
    const { id: storyId } = await user.createStory()

    const res = await user.deleteRaw(`/api/stories/${storyId}/narration`)
    expect(res.ok()).toBe(true)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.deleted).toBe(true)
  })

  test('DELETE narration returns 404 for non-existent story', async ({ user }) => {
    const res = await user.deleteRaw('/api/stories/nonexistent-id-9999/narration')
    expect(res.status()).toBe(404)
  })
})

test.describe('Save narration', () => {
  test.beforeEach(async ({ user }) => {
    await user.login()
  })

  test('save-narration returns 503 when audio generation is disabled', async ({ user }) => {
    if (process.env.AUDIO_GENERATION_ENABLED === 'true') {
      test.skip()
      return
    }

    const { id: storyId } = await user.createStory()

    const res = await user.postRaw(`/api/stories/${storyId}/save-narration`, {})
    expect(res.status()).toBe(503)

    const body = await res.json()
    expect(body.error).toMatch(/not yet available/i)
  })

  test('save-narration requires a voice profile', async ({ user }) => {
    if (process.env.AUDIO_GENERATION_ENABLED !== 'true') {
      test.skip()
      return
    }

    const { id: storyId } = await user.createStory()

    const res = await user.postRaw(`/api/stories/${storyId}/save-narration`, {})
    expect(res.status()).toBe(400)

    const body = await res.json()
    expect(body.error).toMatch(/no voice profile/i)
  })

  test('save-narration returns 404 for non-existent story', async ({ user }) => {
    if (process.env.AUDIO_GENERATION_ENABLED !== 'true') {
      test.skip()
      return
    }

    const res = await user.postRaw('/api/stories/nonexistent-id-9999/save-narration', {
      voiceProfileId: 'some-profile-id',
    })
    expect(res.status()).toBe(404)
  })
})
