import { test, expect, TestUser } from './fixtures'
import { uniqueUserInfo } from './helpers/api'

/**
 * Multi-familyspace E2E coverage.
 *
 * Covers: familyspace creation, switching, member management (invite →
 * accept → member list → remove), settings, cross-space isolation, and
 * permission edge cases.
 *
 * Every test creates its own users through the real API — no pre-seeded data.
 */

/* ------------------------------------------------------------------ */
/* 1. Familyspace Creation                                            */
/* ------------------------------------------------------------------ */

test.describe('Familyspace creation', () => {
  test('creates a new familyspace via POST /api/familyspaces', async ({ user }) => {
    const name = `NewSpace ${Date.now().toString(36)}`
    const body = await user.postJson<{
      id: string; name: string; slug: string; planType: string
    }>('/api/familyspaces', { name })

    expect(body.success).toBe(true)
    expect(body.data?.id).toBeTruthy()
    expect(body.data?.name).toBe(name)
    expect(body.data?.planType).toBe('FREE')

    // Creating a familyspace also updates the user's defaultFamilyspaceId
    user.familyspaceId = body.data!.id
  })

  test('the new familyspace page loads at /familyspace/new', async ({ page, user }) => {
    await page.goto('/familyspace/new', { waitUntil: 'networkidle' })
    // The page should render a form to name the new space
    await expect(page.getByLabel(/family space name|name/i).first()).toBeVisible({ timeout: 15000 })
  })

  test('cannot create a duplicate familyspace with the same name (slug collision)', async ({ user }) => {
    const name = `DupSpace ${Date.now().toString(36)}`
    await user.postJson('/api/familyspaces', { name })

    // Same name → same slug → conflict
    const res = await user.postRaw('/api/familyspaces', { name })
    expect(res.status()).toBe(409)
  })
})

/* ------------------------------------------------------------------ */
/* 2. Familyspace Switching                                           */
/* ------------------------------------------------------------------ */

test.describe('Familyspace switching', () => {
  let spaceA: TestUser
  let spaceBId: string

  test.beforeAll(async () => {
    spaceA = await TestUser.signUp()
    const body = await spaceA.postJson<{ id: string }>('/api/familyspaces', {
      name: `SwitchB ${Date.now().toString(36)}`,
    })
    spaceBId = body.data!.id
  })

  test.afterAll(async () => {
    await spaceA.dispose()
  })

  test('lists all familyspaces the user belongs to', async () => {
    const res = await spaceA.api.get('/api/familyspaces')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeGreaterThanOrEqual(2)

    const spaceIds: string[] = body.data.map((s: { id: string }) => s.id)
    expect(spaceIds).toContain(spaceA.familyspaceId)
    expect(spaceIds).toContain(spaceBId)
  })

  test('switches default familyspace via POST /api/familyspaces/[id]/switch', async () => {
    const body = await spaceA.postJson<{ defaultFamilyspaceId: string }>(
      `/api/familyspaces/${spaceBId}/switch`,
      {},
    )
    expect(body.data!.defaultFamilyspaceId).toBe(spaceBId)

    // The list now shows spaceB as default
    const listRes = await spaceA.api.get('/api/familyspaces')
    const list = await listRes.json()
    const spaceBEntry = list.data.find((s: { id: string }) => s.id === spaceBId)
    expect(spaceBEntry.isDefault).toBe(true)

    // Switch back to the original for clean state
    await spaceA.postJson(`/api/familyspaces/${spaceA.familyspaceId}/switch`, {})
  })

  test('after switching, data is scoped to the new space', async () => {
    // Create a story in space B (the original default)
    await spaceA.postJson(`/api/familyspaces/${spaceA.familyspaceId}/switch`, {})
    const storyInA = await spaceA.createStory({ title: 'Story in Space A' })

    // Switch to space B and verify dashboard stats reflect space B
    await spaceA.postJson(`/api/familyspaces/${spaceBId}/switch`, {})
    const statsRes = await spaceA.api.get('/api/dashboard/stats')
    const stats = await statsRes.json()
    expect(stats.data?.familyspace?.id).toBe(spaceBId)

    // Story from space A should NOT appear in space B's story list
    const storiesRes = await spaceA.api.get('/api/stories')
    const stories = await storiesRes.json()
    const storyIds: string[] = (stories.data?.stories ?? stories.data ?? []).map(
      (s: { id: string }) => s.id,
    )
    expect(storyIds).not.toContain(storyInA.id)

    // Switch back
    await spaceA.postJson(`/api/familyspaces/${spaceA.familyspaceId}/switch`, {})
  })

  test('dashboard stats show current familyspace context', async () => {
    await spaceA.postJson(`/api/familyspaces/${spaceA.familyspaceId}/switch`, {})
    const res = await spaceA.api.get('/api/dashboard/stats')
    const body = await res.json()
    expect(body.data?.familyspace?.id).toBe(spaceA.familyspaceId)
  })
})

/* ------------------------------------------------------------------ */
/* 3. Member Management                                               */
/* ------------------------------------------------------------------ */

test.describe('Member management', () => {
  let owner: TestUser
  let invitee: TestUser
  let inviteToken: string

  test.beforeAll(async () => {
    owner = await TestUser.signUp()
    invitee = await TestUser.signUp()
  })

  test.afterAll(async () => {
    await owner.dispose()
    await invitee.dispose()
  })

  test('invite a user to a familyspace (POST /api/familyspaces/[id]/invite)', async () => {
    const body = await owner.postJson<{
      id: string; email: string; role: string; token: string
    }>('/api/familyspaces/' + owner.familyspaceId + '/invite', {
      email: invitee.info.email,
      role: 'EDITOR',
    })

    expect(body.success).toBe(true)
    expect(body.data!.email).toBe(invitee.info.email)
    expect(body.data!.role).toBe('EDITOR')
    expect(body.data!.token).toBeTruthy()
    inviteToken = body.data!.token
  })

  test('invitee accepts the invite (POST /api/invites/[token]/accept)', async () => {
    const body = await invitee.postJson<{
      message: string; familyspaceId: string; familyspaceName: string
    }>('/api/invites/' + inviteToken + '/accept', {})

    expect(body.success).toBe(true)
    expect(body.data!.familyspaceId).toBe(owner.familyspaceId)
  })

  test('lists members after the invite is accepted', async () => {
    const res = await owner.api.get('/api/familyspaces/' + owner.familyspaceId + '/members')
    const body = await res.json()
    expect(body.success).toBe(true)

    const members: Array<{ userId: string; email: string; role: string }> = body.data
    expect(members.some((m) => m.email === invitee.info.email)).toBe(true)
    expect(members.some((m) => m.email === owner.info.email)).toBe(true)
  })

  test('remove a member (DELETE /api/familyspaces/[id]/members/[userId])', async () => {
    // Extract the invitee's userId from the members list
    const membersRes = await owner.api.get(
      '/api/familyspaces/' + owner.familyspaceId + '/members',
    )
    const members = await membersRes.json()
    const inviteeMember = members.data.find(
      (m: { email: string }) => m.email === invitee.info.email,
    )
    expect(inviteeMember).toBeTruthy()

    const delRes = await owner.deleteRaw(
      '/api/familyspaces/' + owner.familyspaceId + '/members/' + inviteeMember.userId,
    )
    expect(delRes.ok()).toBe(true)
    const delBody = await delRes.json()
    expect(delBody.data?.removed).toBe(true)

    // The removed member no longer appears
    const afterRes = await owner.api.get(
      '/api/familyspaces/' + owner.familyspaceId + '/members',
    )
    const afterMembers = await afterRes.json()
    expect(
      afterMembers.data.some((m: { email: string }) => m.email === invitee.info.email),
    ).toBe(false)
  })

  test('decline an invite (POST /api/invites/[token]/decline)', async () => {
    // Re-invite the (now removed) invitee
    const inviteRes = await owner.postJson<{ token: string }>(
      '/api/familyspaces/' + owner.familyspaceId + '/invite',
      { email: invitee.info.email, role: 'VIEWER' },
    )
    const token = inviteRes.data!.token

    const body = await invitee.postJson<{ message: string }>(
      '/api/invites/' + token + '/decline',
      {},
    )
    expect(body.success).toBe(true)
    expect(body.data!.message).toBe('Invite declined')

    // Invitee should not be a member
    const membersRes = await owner.api.get(
      '/api/familyspaces/' + owner.familyspaceId + '/members',
    )
    const members = await membersRes.json()
    expect(
      members.data.some((m: { email: string }) => m.email === invitee.info.email),
    ).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* 4. Familyspace Settings                                            */
/* ------------------------------------------------------------------ */

test.describe('Familyspace settings', () => {
  test('settings page loads at /familyspaces/[id]/settings', async ({ page, user }) => {
    await page.goto(`/familyspaces/${user.familyspaceId}/settings`, { waitUntil: 'networkidle' })
    await expect(page.getByText(/settings|general/i).first()).toBeVisible({ timeout: 15000 })
  })

  test('can update familyspace name via PUT /api/familyspaces/[id]', async ({ user }) => {
    const newName = `Renamed ${Date.now().toString(36)}`
    const putRes = await user.putRaw(
      '/api/familyspaces/' + user.familyspaceId,
      { name: newName },
    )
    expect(putRes.ok()).toBe(true)
    const putBody = await putRes.json()
    expect(putBody.data?.name).toBe(newName)

    // Re-fetch to confirm
    const getRes = await user.api.get('/api/familyspaces/' + user.familyspaceId)
    const getBody = await getRes.json()
    expect(getBody.data?.name).toBe(newName)
  })

  test('export familyspace data returns a ZIP (GET /api/familyspaces/[id]/export)', async ({
    user,
  }) => {
    const res = await user.api.get('/api/familyspaces/' + user.familyspaceId + '/export')
    // Export requires ADMIN role; created spaces default to OWNER, which satisfies.
    expect([200, 204]).toContain(res.status())
    const contentType = res.headers()['content-type'] ?? ''
    expect(contentType).toContain('zip')
  })
})

/* ------------------------------------------------------------------ */
/* 5. Cross-space Isolation                                           */
/* ------------------------------------------------------------------ */

test.describe('Cross-space isolation', () => {
  let alice: TestUser
  let bob: TestUser
  let aliceStoryId: string
  let alicePersonId: string
  let bobSpaceBId: string

  test.beforeAll(async () => {
    alice = await TestUser.signUp()
    bob = await TestUser.signUp()

    // Alice creates a story in her default space
    aliceStoryId = (await alice.createStory({ title: 'Alice Isolated Story' })).id

    // Alice adds a person in her space
    const personBody = await alice.postJson<{ id: string }>('/api/people', {
      firstName: 'Isolated',
      lastName: `Person${Date.now().toString(36)}`,
    })
    alicePersonId = personBody.data!.id

    // Bob creates a second familyspace in addition to his default
    const bBody = await bob.postJson<{ id: string }>('/api/familyspaces', {
      name: `BobSpaceB ${Date.now().toString(36)}`,
    })
    bobSpaceBId = bBody.data!.id
  })

  test.afterAll(async () => {
    await alice.dispose()
    await bob.dispose()
  })

  test("stories created in space A are not visible in user B's default space", async () => {
    const res = await bob.api.get('/api/stories')
    const body = await res.json()
    const stories: Array<{ id: string }> = body.data?.stories ?? body.data ?? []
    expect(stories.find((s) => s.id === aliceStoryId)).toBeFalsy()
  })

  test("people added in space A are not in user B's default space", async () => {
    // Bob tries to read Alice's person record directly
    const res = await bob.api.get('/api/people/' + alicePersonId)
    expect([403, 404]).toContain(res.status())

    // Bob's own people list should not contain Alice's person
    const listRes = await bob.api.get('/api/people')
    const listBody = await listRes.json()
    const people: Array<{ id: string }> =
      listBody.data?.people ?? listBody.data ?? []
    expect(people.find((p) => p.id === alicePersonId)).toBeFalsy()
  })

  test("dashboard stats are scoped per familyspace — Bob's space B is empty", async () => {
    await bob.postJson('/api/familyspaces/' + bobSpaceBId + '/switch', {})
    const statsRes = await bob.api.get('/api/dashboard/stats')
    const stats = await statsRes.json()
    expect(stats.data?.familyspace?.id).toBe(bobSpaceBId)
    // A brand-new space should have 0 people, 0 stories
    expect(stats.data?.stats?.people).toBe(0)
    expect(stats.data?.stats?.stories).toBe(0)

    // Switch back
    await bob.postJson('/api/familyspaces/' + bob.familyspaceId + '/switch', {})
  })
})

/* ------------------------------------------------------------------ */
/* 6. Edge cases / Permission guards                                  */
/* ------------------------------------------------------------------ */

test.describe('Edge cases & permissions', () => {
  test('cannot switch to a familyspace the user does not belong to', async () => {
    const outsider = await TestUser.signUp()
    const owner = await TestUser.signUp()

    const res = await outsider.postRaw(
      '/api/familyspaces/' + owner.familyspaceId + '/switch',
      {},
    )
    expect([403, 404]).toContain(res.status())

    await outsider.dispose()
    await owner.dispose()
  })

  test('cannot invite to a familyspace without ADMIN role', async () => {
    // Create owner + a viewer member
    const owner = await TestUser.signUp()
    const viewerInfo = uniqueUserInfo('viewer')
    const viewer = await TestUser.signUp({ info: viewerInfo, onboard: false })

    // Invite viewer as VIEWER
    const inviteBody = await owner.postJson<{ token: string }>(
      '/api/familyspaces/' + owner.familyspaceId + '/invite',
      { email: viewer.info.email, role: 'VIEWER' },
    )
    await viewer.postJson('/api/invites/' + inviteBody.data!.token + '/accept', {})

    // Now the viewer (a VIEWER) tries to invite someone else → should fail
    const res = await viewer.postRaw(
      '/api/familyspaces/' + owner.familyspaceId + '/invite',
      { email: owner.info.email, role: 'VIEWER' },
    )
    expect(res.status()).toBe(403)

    await owner.dispose()
    await viewer.dispose()
  })

  test('invite to a non-existent familyspace returns error', async ({ user }) => {
    const res = await user.postRaw(
      '/api/familyspaces/nonexistent-id-00000/invite',
      { email: user.info.email, role: 'VIEWER' },
    )
    // Likely 400 (bad id format from Prisma) or 404
    expect([400, 404]).toContain(res.status())
  })

  test('member removal requires ADMIN role', async () => {
    const owner = await TestUser.signUp()
    const viewerInfo = uniqueUserInfo('viewer2')
    const viewer = await TestUser.signUp({ info: viewerInfo, onboard: false })

    const inviteBody = await owner.postJson<{ token: string }>(
      '/api/familyspaces/' + owner.familyspaceId + '/invite',
      { email: viewer.info.email, role: 'VIEWER' },
    )
    await viewer.postJson('/api/invites/' + inviteBody.data!.token + '/accept', {})

    // Viewer tries to remove the owner → should fail
    const membersRes = await owner.api.get(
      '/api/familyspaces/' + owner.familyspaceId + '/members',
    )
    const members = await membersRes.json()
    const ownerMember = members.data.find(
      (m: { email: string }) => m.email === owner.info.email,
    )

    const res = await viewer.deleteRaw(
      '/api/familyspaces/' + owner.familyspaceId + '/members/' + ownerMember.userId,
    )
    expect(res.status()).toBe(403)

    await owner.dispose()
    await viewer.dispose()
  })

  test('accepting an invite with a mismatched email is rejected', async () => {
    const owner = await TestUser.signUp()
    const invited = await TestUser.signUp()
    const wrongUser = await TestUser.signUp()

    const inviteBody = await owner.postJson<{ token: string }>(
      '/api/familyspaces/' + owner.familyspaceId + '/invite',
      { email: invited.info.email, role: 'VIEWER' },
    )

    // wrongUser tries to accept an invite sent to invited's email
    const res = await wrongUser.postRaw(
      '/api/invites/' + inviteBody.data!.token + '/accept',
      {},
    )
    expect(res.status()).toBe(403)

    await owner.dispose()
    await invited.dispose()
    await wrongUser.dispose()
  })

  test('cannot remove the familyspace owner', async () => {
    const owner = await TestUser.signUp()

    // Get the owner's membership userId
    const membersRes = await owner.api.get(
      '/api/familyspaces/' + owner.familyspaceId + '/members',
    )
    const members = await membersRes.json()
    const ownerMember = members.data.find(
      (m: { email: string }) => m.email === owner.info.email,
    )

    const res = await owner.deleteRaw(
      '/api/familyspaces/' + owner.familyspaceId + '/members/' + ownerMember.userId,
    )
    expect(res.status()).toBe(400) // "Cannot remove the familyspace owner"

    await owner.dispose()
  })
})
