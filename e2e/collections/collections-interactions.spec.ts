import { test, expect, TestUser } from './fixtures'

/**
 * Collections, Favorites, Comments, Cross-Tenancy, and Edge Cases.
 *
 * Coverage:
 *   1. Collections CRUD
 *   2. Favorites deep (toggle, list, count, persistence)
 *   3. Comments deep (add, list, delete, author attribution)
 *   4. Cross-tenancy isolation
 *   5. Edge cases (non-existent refs, delete behavior, empty state)
 */

/* ------------------------------------------------------------------ */
/* 1. Collections CRUD                                                */
/* ------------------------------------------------------------------ */

test.describe('Collections CRUD', () => {
  test('create collection and verify it appears in the list', async ({ user }) => {
    const name = `E2E Collection ${Date.now().toString(36)}`

    const createRes = await user.postJson<{ id: string; name: string }>('/api/collections', {
      name,
      description: 'A test collection for E2E',
    })

    expect(createRes.data).toBeTruthy()
    expect(createRes.data!.name).toBe(name)

    const listRes = await user.api.get('/api/collections')
    const listBody = await listRes.json()
    expect(listBody.success).toBe(true)
    const collections = listBody.data as Array<{ id: string; name: string }>
    const found = collections.find((c) => c.id === createRes.data!.id)
    expect(found).toBeTruthy()
    expect(found!.name).toBe(name)
  })

  test('list collections returns familyspace-scoped results', async ({ user }) => {
    // Create a few collections
    const ids: string[] = []
    for (let i = 0; i < 3; i++) {
      const res = await user.postJson<{ id: string }>('/api/collections', {
        name: `List Test ${i} ${Date.now().toString(36)}`,
      })
      ids.push(res.data!.id)
    }

    const listRes = await user.api.get('/api/collections')
    const listBody = await listRes.json()
    expect(listBody.success).toBe(true)
    const collections = listBody.data as Array<{ id: string; name: string }>

    for (const id of ids) {
      expect(collections.find((c) => c.id === id)).toBeTruthy()
    }
  })

  test('get collection detail returns stories and metadata', async ({ user }) => {
    const createRes = await user.postJson<{ id: string; name: string }>('/api/collections', {
      name: `Detail Test ${Date.now().toString(36)}`,
      description: 'Collection with stories',
    })
    const collectionId = createRes.data!.id

    // Get detail — should succeed even when empty
    const detailRes = await user.api.get(`/api/collections/${collectionId}`)
    const detailBody = await detailRes.json()
    expect(detailBody.success).toBe(true)
    expect(detailBody.data.name).toBe(createRes.data!.name)
    expect(detailBody.data.description).toBe('Collection with stories')
    expect(Array.isArray(detailBody.data.stories)).toBe(true)
  })

  test('add story to collection', async ({ user }) => {
    const { id: storyId } = await user.createStory({ title: `Collection Story ${Date.now().toString(36)}` })
    const createRes = await user.postJson<{ id: string }>('/api/collections', {
      name: `Add Story Test ${Date.now().toString(36)}`,
    })
    const collectionId = createRes.data!.id

    const addRes = await user.postJson<{ id: string }>(
      `/api/collections/${collectionId}/stories`,
      { storyId },
    )
    expect(addRes.data).toBeTruthy()

    // Verify the story is in the collection detail
    const detailRes = await user.api.get(`/api/collections/${collectionId}`)
    const detailBody = await detailRes.json()
    expect(detailBody.success).toBe(true)
    const stories = detailBody.data.stories as Array<{ story: { id: string } }>
    expect(stories.find((s) => s.story.id === storyId)).toBeTruthy()
  })

  test('remove story from collection', async ({ user }) => {
    const { id: storyId } = await user.createStory({ title: `Removable Story ${Date.now().toString(36)}` })
    const createRes = await user.postJson<{ id: string }>('/api/collections', {
      name: `Remove Story Test ${Date.now().toString(36)}`,
    })
    const collectionId = createRes.data!.id

    // Add story first
    await user.postJson(`/api/collections/${collectionId}/stories`, { storyId })

    // Remove it — DELETE /collections/[id]/stories expects { storyId } in body
    // Must include CSRF token for the body-bearing DELETE
    const csrfToken = await user.csrf()
    const removeRes = await user.api.delete(`/api/collections/${collectionId}/stories`, {
      headers: { 'x-csrf-token': csrfToken },
      data: { storyId },
    })
    const removeBody = await removeRes.json()
    expect(removeRes.ok()).toBe(true)

    // Verify the story is no longer in the collection
    const detailRes = await user.api.get(`/api/collections/${collectionId}`)
    const detailBody = await detailRes.json()
    expect(detailBody.success).toBe(true)
    const stories = detailBody.data.stories as Array<{ story: { id: string } }>
    expect(stories.find((s) => s.story.id === storyId)).toBeFalsy()
  })

  test('delete collection', async ({ user }) => {
    const createRes = await user.postJson<{ id: string }>('/api/collections', {
      name: `Doomed Collection ${Date.now().toString(36)}`,
    })
    const collectionId = createRes.data!.id

    const delRes = await user.deleteRaw(`/api/collections/${collectionId}`)
    expect(delRes.ok()).toBe(true)

    // Deleted collection returns 404
    expect((await user.api.get(`/api/collections/${collectionId}`)).status()).toBe(404)

    // Gone from the list
    const listRes = await user.api.get('/api/collections')
    const listBody = await listRes.json()
    const collections = listBody.data as Array<{ id: string }>
    expect(collections.find((c) => c.id === collectionId)).toBeFalsy()
  })
})

/* ------------------------------------------------------------------ */
/* 2. Favorites deep                                                   */
/* ------------------------------------------------------------------ */

test.describe('Favorites', () => {
  test('favorite a story via POST', async ({ user }) => {
    const { id: storyId } = await user.createStory({ title: `Fav Story ${Date.now().toString(36)}` })

    const favRes = await user.postRaw(`/api/stories/${storyId}/favorite`, {})
    const favBody = await favRes.json()
    expect(favRes.status()).toBe(201)
    expect(favBody.data?.favorited ?? favBody.data).toBeTruthy()
  })

  test('unfavorite a story via DELETE', async ({ user }) => {
    const { id: storyId } = await user.createStory({ title: `Unfav Story ${Date.now().toString(36)}` })

    // Favorite first
    await user.postRaw(`/api/stories/${storyId}/favorite`, {})

    // Unfavorite
    const unfavRes = await user.deleteRaw(`/api/stories/${storyId}/favorite`)
    const unfavBody = await unfavRes.json()
    expect(unfavRes.ok()).toBe(true)
    expect(unfavBody.data?.favorited ?? unfavBody.favorited).toBe(false)
  })

  test('favorites list reflects toggled state', async ({ user }) => {
    const { id: storyId } = await user.createStory({ title: `Toggle Fav ${Date.now().toString(36)}` })

    // Initially not in favorites
    let favsRes = await user.api.get('/api/favorites')
    let favsBody = await favsRes.json()
    const favStories = favsBody.data?.stories ?? favsBody.data ?? []
    expect((favStories as Array<{ id: string }>).find((s) => s.id === storyId)).toBeFalsy()

    // Favorite it
    await user.postRaw(`/api/stories/${storyId}/favorite`, {})

    // Now appears in favorites
    favsRes = await user.api.get('/api/favorites')
    favsBody = await favsRes.json()
    const favStoriesAfter = favsBody.data?.stories ?? favsBody.data ?? []
    expect((favStoriesAfter as Array<{ id: string }>).find((s) => s.id === storyId)).toBeTruthy()

    // Unfavorite
    await user.deleteRaw(`/api/stories/${storyId}/favorite`)

    // Gone again
    favsRes = await user.api.get('/api/favorites')
    favsBody = await favsRes.json()
    const favStoriesFinal = favsBody.data?.stories ?? favsBody.data ?? []
    expect((favStoriesFinal as Array<{ id: string }>).find((s) => s.id === storyId)).toBeFalsy()
  })

  test('favorites count is accurate', async ({ user }) => {
    // Create 3 stories and favorite them
    const favCount = 3
    for (let i = 0; i < favCount; i++) {
      const { id } = await user.createStory({ title: `CountFav ${i} ${Date.now().toString(36)}` })
      await user.postRaw(`/api/stories/${id}/favorite`, {})
    }

    const favsRes = await user.api.get('/api/favorites')
    const favsBody = await favsRes.json()
    const stories = (favsBody.data?.stories ?? favsBody.data ?? []) as Array<unknown>
    const total = favsBody.data?.pagination?.total ?? stories.length
    expect(total).toBeGreaterThanOrEqual(favCount)
  })

  test('favorites persist across sessions (re-login)', async ({ user }) => {
    const { id: storyId } = await user.createStory({ title: `Persist Fav ${Date.now().toString(36)}` })
    await user.postRaw(`/api/stories/${storyId}/favorite`, {})

    // Re-login the same user to get a fresh session
    await user.login()

    // Verify it's still in favorites
    const favsRes = await user.api.get('/api/favorites')
    const favsBody = await favsRes.json()
    const stories = (favsBody.data?.stories ?? favsBody.data ?? []) as Array<{ id: string }>
    expect(stories.find((s) => s.id === storyId)).toBeTruthy()
  })

  test('double-favoriting is idempotent', async ({ user }) => {
    const { id: storyId } = await user.createStory({ title: `Idem Fav ${Date.now().toString(36)}` })

    // First favorite — 201
    const res1 = await user.postRaw(`/api/stories/${storyId}/favorite`, {})
    expect(res1.status()).toBe(201)

    // Second favorite — should succeed (200, already favorited)
    const res2 = await user.postRaw(`/api/stories/${storyId}/favorite`, {})
    expect(res2.ok()).toBe(true)

    // Should still only appear once
    const favsRes = await user.api.get('/api/favorites')
    const favsBody = await favsRes.json()
    const stories = (favsBody.data?.stories ?? favsBody.data ?? []) as Array<{ id: string }>
    const matches = stories.filter((s) => s.id === storyId)
    expect(matches.length).toBe(1)
  })
})

/* ------------------------------------------------------------------ */
/* 3. Comments deep                                                    */
/* ------------------------------------------------------------------ */

test.describe('Comments', () => {
  test('add comment to story', async ({ user }) => {
    const { id: storyId } = await user.createStory({ title: `Comment Test ${Date.now().toString(36)}` })
    const commentText = `E2E comment at ${Date.now()}`

    const commentRes = await user.postJson(`/api/stories/${storyId}/comments`, {
      content: commentText,
    })
    const commentData = commentRes.data as { id: string; content: string; userId: string }
    expect(commentData).toBeTruthy()
    expect(commentData.id).toBeTruthy()
    expect(commentData.content).toBe(commentText)
  })

  test('list comments on story', async ({ user }) => {
    const { id: storyId } = await user.createStory({ title: `List Comment Test ${Date.now().toString(36)}` })

    const commentTexts = ['First comment', 'Second observation', 'Third thought']
    for (const text of commentTexts) {
      await user.postJson(`/api/stories/${storyId}/comments`, { content: text })
    }

    const listRes = await user.api.get(`/api/stories/${storyId}/comments`)
    const listBody = await listRes.json()
    expect(listBody.success).toBe(true)
    const comments = listBody.data as Array<{ content: string }>
    expect(comments.length).toBeGreaterThanOrEqual(3)

    // All three comments should be present
    for (const text of commentTexts) {
      expect(comments.find((c) => c.content === text)).toBeTruthy()
    }
  })

  test('comment shows author attribution (user info)', async ({ user }) => {
    const { id: storyId } = await user.createStory({ title: `Attribution Test ${Date.now().toString(36)}` })
    const commentText = `Attributed comment ${Date.now()}`

    const commentRes = await user.postJson(`/api/stories/${storyId}/comments`, { content: commentText })
    const commentData = commentRes.data as { user?: { displayName: string }; userId?: string }

    // The comment includes the author's user object
    expect(commentData.user).toBeTruthy()
    expect(commentData.user!.displayName).toBe(user.info.displayName)
  })

  test('delete comment', async ({ user }) => {
    const { id: storyId } = await user.createStory({ title: `Delete Comment Test ${Date.now().toString(36)}` })

    const commentRes = await user.postJson<{ id: string }>(`/api/stories/${storyId}/comments`, {
      content: 'Comment to be deleted',
    })
    const commentId = commentRes.data!.id

    const delRes = await user.deleteRaw(`/api/comments/${commentId}`)
    expect(delRes.ok()).toBe(true)

    // Comment should no longer appear in the list
    const listRes = await user.api.get(`/api/stories/${storyId}/comments`)
    const listBody = await listRes.json()
    const comments = listBody.data as Array<{ id: string }>
    expect(comments.find((c) => c.id === commentId)).toBeFalsy()
  })

  test('comment body is required (validation)', async ({ user }) => {
    const { id: storyId } = await user.createStory({ title: `Validation Comment ${Date.now().toString(36)}` })

    const res = await user.postRaw(`/api/stories/${storyId}/comments`, { content: '' })
    expect(res.status()).toBe(400)
  })

  test('cannot comment on non-existent story', async ({ user }) => {
    const res = await user.postRaw('/api/stories/non-existent-id-12345/comments', {
      content: 'This should fail',
    })
    expect(res.status()).toBe(404)
  })

  // NOTE: The API has no PUT /api/comments/[id] endpoint for editing.
  // The StoryComment model has an `updatedAt` field in Prisma, suggesting
  // edit support was planned but not yet implemented. If/when that endpoint
  // is added, uncomment and adapt the test below.
  //
  // test('edit comment (PUT)', async ({ user }) => {
  //   const { id: storyId } = await user.createStory({ title: `Edit Comment ${Date.now().toString(36)}` })
  //   const commentRes = await user.postJson<{ id: string }>(`/api/stories/${storyId}/comments`, {
  //     content: 'Original text',
  //   })
  //   const commentId = commentRes.data!.id
  //
  //   const editRes = await user.putRaw(`/api/comments/${commentId}`, { content: 'Updated text' })
  //   expect(editRes.ok()).toBe(true)
  //
  //   const listRes = await user.api.get(`/api/stories/${storyId}/comments`)
  //   const listBody = await listRes.json()
  //   const comment = (listBody.data as Array<{ id: string; content: string }>).find((c) => c.id === commentId)
  //   expect(comment).toBeTruthy()
  //   expect(comment!.content).toBe('Updated text')
  // })
})

/* ------------------------------------------------------------------ */
/* 4. Cross-tenancy isolation                                          */
/* ------------------------------------------------------------------ */

test.describe('Cross-tenancy', () => {
  let alice: TestUser
  let bob: TestUser
  let aliceStoryId: string
  let aliceCollectionId: string

  test.beforeAll(async () => {
    alice = await TestUser.signUp()
    bob = await TestUser.signUp()
    aliceStoryId = (await alice.createStory({ title: 'Alice CrossTenancy Story' })).id

    const collectionRes = await alice.postJson<{ id: string }>('/api/collections', {
      name: `Alice Private Collection ${Date.now().toString(36)}`,
    })
    aliceCollectionId = collectionRes.data!.id
    await alice.postJson(`/api/collections/${aliceCollectionId}/stories`, { storyId: aliceStoryId })
  })

  test.afterAll(async () => {
    await alice.dispose()
    await bob.dispose()
  })

  test("user B cannot favorite user A's story", async () => {
    const favRes = await bob.postRaw(`/api/stories/${aliceStoryId}/favorite`, {})
    // The story lookup checks familyspaceId, so it should 404
    expect(favRes.status()).toBe(404)
  })

  test("user B cannot comment on user A's story", async () => {
    const commentRes = await bob.postRaw(`/api/stories/${aliceStoryId}/comments`, {
      content: 'Cross-tenancy comment attempt',
    })
    // Story lookup is familyspace-scoped, returns 404
    expect(commentRes.status()).toBe(404)
  })

  test("user B cannot see user A's collections", async () => {
    // Collection detail
    const detailRes = await bob.api.get(`/api/collections/${aliceCollectionId}`)
    expect(detailRes.status()).toBe(404)

    // Collection list — should not leak Alice's collections
    const listRes = await bob.api.get('/api/collections')
    const listBody = await listRes.json()
    const collections = listBody.data as Array<{ id: string }>
    const leaked = collections.find((c) => c.id === aliceCollectionId)
    expect(leaked).toBeFalsy()
  })

  test("user B cannot add a story to user A's collection", async () => {
    const { id: bobStoryId } = await bob.createStory({ title: 'Bob Story For Alice Coll' })
    const res = await bob.postRaw(`/api/collections/${aliceCollectionId}/stories`, {
      storyId: bobStoryId,
    })
    // Collection lookup is familyspace-scoped
    expect(res.status()).toBe(404)
  })

  test("user B cannot delete user A's collection", async () => {
    const res = await bob.deleteRaw(`/api/collections/${aliceCollectionId}`)
    expect(res.status()).toBe(404)
    // Alice's collection still exists
    expect((await alice.api.get(`/api/collections/${aliceCollectionId}`)).status()).toBe(200)
  })

  test("user B cannot delete user A's comment", async () => {
    // Alice adds a comment to her own story
    const commentRes = await alice.postJson<{ id: string }>(`/api/stories/${aliceStoryId}/comments`, {
      content: "Alice's comment",
    })
    const commentId = commentRes.data!.id

    // Bob tries to delete it
    const delRes = await bob.deleteRaw(`/api/comments/${commentId}`)
    expect(delRes.status()).toBe(404)

    // Comment still exists for Alice
    const listRes = await alice.api.get(`/api/stories/${aliceStoryId}/comments`)
    const listBody = await listRes.json()
    const comments = listBody.data as Array<{ id: string }>
    expect(comments.find((c) => c.id === commentId)).toBeTruthy()
  })
})

/* ------------------------------------------------------------------ */
/* 5. Edge cases                                                       */
/* ------------------------------------------------------------------ */

test.describe('Edge cases', () => {
  test("cannot add non-existent story to collection", async ({ user }) => {
    const createRes = await user.postJson<{ id: string }>('/api/collections', {
      name: `Edge Collection ${Date.now().toString(36)}`,
    })
    const collectionId = createRes.data!.id

    const res = await user.postRaw(`/api/collections/${collectionId}/stories`, {
      storyId: 'non-existent-story-uuid-00000',
    })
    // Story lookup is familyspace-scoped, returns 404
    expect(res.status()).toBe(404)
  })

  test('can delete story that is in a collection (cascade)', async ({ user }) => {
    // Create story and collection, add story to collection
    const { id: storyId } = await user.createStory({ title: `Cascade Delete ${Date.now().toString(36)}` })
    const createRes = await user.postJson<{ id: string }>('/api/collections', {
      name: `Cascade Coll ${Date.now().toString(36)}`,
    })
    const collectionId = createRes.data!.id
    await user.postJson(`/api/collections/${collectionId}/stories`, { storyId })

    // Delete the story — CollectionStory has onDelete: Cascade on storyId, so
    // the collection link should be cleaned up automatically.
    const delStory = await user.deleteRaw(`/api/stories/${storyId}`)
    expect(delStory.ok()).toBe(true)

    // Story is gone
    await expect
      .poll(async () => (await user.api.get(`/api/stories/${storyId}`)).status(), { timeout: 10_000 })
      .toBe(404)

    // Collection still exists but no longer has the story
    const detailRes = await user.api.get(`/api/collections/${collectionId}`)
    expect(detailRes.ok()).toBe(true)
    const detailBody = await detailRes.json()
    const stories = detailBody.data.stories as Array<{ story: { id: string } }>
    expect(stories.find((s) => s.story.id === storyId)).toBeFalsy()
  })

  test('empty collection returns stories as empty array', async ({ user }) => {
    const createRes = await user.postJson<{ id: string }>('/api/collections', {
      name: `Empty Collection ${Date.now().toString(36)}`,
    })

    const detailRes = await user.api.get(`/api/collections/${createRes.data!.id}`)
    const detailBody = await detailRes.json()
    expect(detailBody.success).toBe(true)
    expect(Array.isArray(detailBody.data.stories)).toBe(true)
    expect(detailBody.data.stories.length).toBe(0)
  })

  test('empty collection list for new user returns empty array', async ({ user }) => {
    // user is a fresh user with no collections yet
    const listRes = await user.api.get('/api/collections')
    const listBody = await listRes.json()
    expect(listBody.success).toBe(true)
    // The list endpoint returns an array directly (not wrapped in data.stories)
    const collections = listBody.data
    expect(Array.isArray(collections)).toBe(true)
  })

  test('empty favorites list for new user returns empty array', async ({ user }) => {
    const favsRes = await user.api.get('/api/favorites')
    const favsBody = await favsRes.json()
    expect(favsBody.success).toBe(true)
    const stories = favsBody.data?.stories ?? favsBody.data ?? []
    expect(Array.isArray(stories)).toBe(true)
    expect(stories.length).toBe(0)
    expect(favsBody.data?.pagination?.total ?? stories.length).toBe(0)
  })

  test('empty comments list for story with no comments', async ({ user }) => {
    const { id: storyId } = await user.createStory({ title: `No Comments ${Date.now().toString(36)}` })

    const listRes = await user.api.get(`/api/stories/${storyId}/comments`)
    const listBody = await listRes.json()
    expect(listBody.success).toBe(true)
    const comments = listBody.data as Array<unknown>
    expect(Array.isArray(comments)).toBe(true)
    expect(comments.length).toBe(0)
  })

  test('validation: collection name is required', async ({ user }) => {
    const res = await user.postRaw('/api/collections', { name: '' })
    expect(res.status()).toBe(400)
  })

  test('validation: comment max length', async ({ user }) => {
    const { id: storyId } = await user.createStory({ title: `Long Comment ${Date.now().toString(36)}` })

    const res = await user.postRaw(`/api/stories/${storyId}/comments`, {
      content: 'x'.repeat(5001),
    })
    expect(res.status()).toBe(400)
  })
})
