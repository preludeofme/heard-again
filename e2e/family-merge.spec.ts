import { test, expect, TestUser } from './fixtures'
import { uniqueUserInfo } from './helpers/api'

/**
 * Family Merge E2E coverage.
 *
 * Covers: analysis, proposal CRUD, execute, UI page, cross-tenancy, and edge cases.
 *
 * Every test creates its own users through the real API — no pre-seeded data.
 */

/* ------------------------------------------------------------------ */
/* 1. Family Merge Analysis                                           */
/* ------------------------------------------------------------------ */

test.describe('Family Merge Analysis', () => {
  let alice: TestUser
  let bob: TestUser
  let aliceSecondSpaceId: string
  let bobSecondSpaceId: string

  test.beforeAll(async () => {
    alice = await TestUser.signUp()
    bob = await TestUser.signUp()

    // Alice creates a second familyspace so she has two spaces to analyze
    const aliceBody = await alice.postJson<{ id: string }>('/api/familyspaces', {
      name: `AliceSecond ${Date.now().toString(36)}`,
    })
    aliceSecondSpaceId = aliceBody.data!.id

    // Bob also creates a second familyspace
    const bobBody = await bob.postJson<{ id: string }>('/api/familyspaces', {
      name: `BobSecond ${Date.now().toString(36)}`,
    })
    bobSecondSpaceId = bobBody.data!.id
  })

  test.afterAll(async () => {
    await alice.dispose()
    await bob.dispose()
  })

  test('analyze returns match candidates between two familyspaces', async () => {
    const body = await alice.postJson<{
      targetFamilyspaceId: string
      sourceFamilyspaceId: string
      totalSourcePeople: number
      matchedPeopleCount: number
      overallMatchScore: number
      matches: Array<{ matchScore: number; matchReason: string }>
    }>('/api/family-merge/analyze', {
      sourceFamilyspaceId: aliceSecondSpaceId,
    })

    expect(body.success).toBe(true)
    expect(body.data?.targetFamilyspaceId).toBe(alice.familyspaceId)
    expect(body.data?.sourceFamilyspaceId).toBe(aliceSecondSpaceId)
    expect(Array.isArray(body.data?.matches)).toBe(true)
    expect(typeof body.data!.overallMatchScore).toBe('number')
    expect(typeof body.data!.matchedPeopleCount).toBe('number')
  })

  test('analyze requires authenticated user', async () => {
    const res = await alice.postRaw('/api/family-merge/analyze', {
      sourceFamilyspaceId: aliceSecondSpaceId,
    })
    // CSRF token should be present, but unauthenticated endpoint test is
    // covered in access-control.spec.ts. Here we verify the endpoint exists
    // and accepts calls from an authenticated user with ADMIN role.
    expect(res.ok()).toBe(true)
  })

  test('analyze with invalid familyspace returns error', async () => {
    const res = await alice.postRaw('/api/family-merge/analyze', {
      sourceFamilyspaceId: 'nonexistent-id-00000',
    })
    expect([403, 404]).toContain(res.status())
  })

  test('cross-tenancy: user B cannot analyze user A familyspace', async () => {
    // Bob tries to analyze Alice's default familyspace
    const res = await bob.postRaw('/api/family-merge/analyze', {
      sourceFamilyspaceId: alice.familyspaceId,
    })
    expect([403, 404]).toContain(res.status())
  })

  test('analyze without sourceFamilyspaceId returns 400', async () => {
    const res = await alice.postRaw('/api/family-merge/analyze', {})
    expect(res.status()).toBe(400)
  })
})

/* ------------------------------------------------------------------ */
/* 2. Proposal Management                                              */
/* ------------------------------------------------------------------ */

test.describe('Proposal Management', () => {
  let owner: TestUser
  let ownerSecondSpaceId: string

  test.beforeAll(async () => {
    owner = await TestUser.signUp()
    const body = await owner.postJson<{ id: string }>('/api/familyspaces', {
      name: `MergeSource ${Date.now().toString(36)}`,
    })
    ownerSecondSpaceId = body.data!.id
  })

  test.afterAll(async () => {
    await owner.dispose()
  })

  test('creates a merge proposal (POST /api/family-merge/proposals)', async () => {
    const body = await owner.postJson<{
      proposal: {
        id: string
        status: string
        targetFamilyspaceId: string
        sourceFamilyspaceId: string
        matchedPeopleCount: number
      }
      summary: { matchedPeopleCount: number; overallMatchScore: number }
    }>('/api/family-merge/proposals', {
      sourceFamilyspaceId: ownerSecondSpaceId,
    })

    expect(body.success).toBe(true)
    expect(body.data?.proposal.id).toBeTruthy()
    expect(body.data?.proposal.status).toBe('PENDING')
    expect(body.data?.proposal.targetFamilyspaceId).toBe(owner.familyspaceId)
    expect(body.data?.proposal.sourceFamilyspaceId).toBe(ownerSecondSpaceId)
    expect(body.data?.summary.matchedPeopleCount).toBe(body.data.proposal.matchedPeopleCount)
  })

  test('lists proposals (GET /api/family-merge/proposals)', async () => {
    const res = await owner.api.get('/api/family-merge/proposals')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data.proposals)).toBe(true)
    expect(body.data.proposals.length).toBeGreaterThanOrEqual(1)

    const proposal = body.data.proposals[0]
    expect(proposal.id).toBeTruthy()
    expect(proposal.status).toBeTruthy()
    expect(proposal._count).toBeTruthy()
  })

  test('gets proposal detail (GET /api/family-merge/proposals/:id)', async () => {
    // Create a fresh proposal so we have a known id
    const createRes = await owner.postJson<{
      proposal: { id: string; status: string; personMatches: unknown[] }
    }>('/api/family-merge/proposals', {
      sourceFamilyspaceId: ownerSecondSpaceId,
    })

    expect(createRes.success).toBe(true)

    // Now fetch the detail
    const res = await owner.api.get(
      `/api/family-merge/proposals/${createRes.data!.proposal.id}`,
    )
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.proposal.id).toBe(createRes.data!.proposal.id)
    expect(Array.isArray(body.data.proposal.personMatches)).toBe(true)
  })

  test('approves a proposal (PATCH status=APPROVED)', async () => {
    // Create a fresh proposal to approve
    const createRes = await owner.postJson<{
      proposal: { id: string }
    }>('/api/family-merge/proposals', {
      sourceFamilyspaceId: ownerSecondSpaceId,
    })
    const proposalId = createRes.data!.proposal.id

    const patchRes = await owner.api.patch(
      `/api/family-merge/proposals/${proposalId}`,
      {
        headers: { 'x-csrf-token': await owner.csrf() },
        data: { status: 'APPROVED' },
      },
    )
    expect(patchRes.ok()).toBe(true)
    const patchBody = await patchRes.json()
    expect(patchBody.data.proposal.status).toBe('APPROVED')

    // Confirm via detail endpoint
    const getRes = await owner.api.get(`/api/family-merge/proposals/${proposalId}`)
    const getBody = await getRes.json()
    expect(getBody.data.proposal.status).toBe('APPROVED')
  })

  test('rejects a proposal (PATCH status=REJECTED)', async () => {
    // Create a fresh proposal to reject
    const createRes = await owner.postJson<{
      proposal: { id: string }
    }>('/api/family-merge/proposals', {
      sourceFamilyspaceId: ownerSecondSpaceId,
    })
    const proposalId = createRes.data!.proposal.id

    const patchRes = await owner.api.patch(
      `/api/family-merge/proposals/${proposalId}`,
      {
        headers: { 'x-csrf-token': await owner.csrf() },
        data: { status: 'REJECTED' },
      },
    )
    expect(patchRes.ok()).toBe(true)
    const patchBody = await patchRes.json()
    expect(patchBody.data.proposal.status).toBe('REJECTED')
  })

  test('cannot modify a non-existent proposal', async () => {
    const res = await owner.api.patch(
      '/api/family-merge/proposals/nonexistent-id-00000',
      {
        headers: { 'x-csrf-token': await owner.csrf() },
        data: { status: 'APPROVED' },
      },
    )
    expect(res.status()).toBe(404)
  })

  test('cannot create a duplicate proposal for the same pair', async () => {
    // A proposal already exists from the "creates a merge proposal" test
    const res = await owner.postRaw('/api/family-merge/proposals', {
      sourceFamilyspaceId: ownerSecondSpaceId,
    })
    // Should return 409 because a PENDING or APPROVED proposal already exists
    expect(res.status()).toBe(409)
  })

  test('cannot merge a familyspace with itself', async () => {
    const res = await owner.postRaw('/api/family-merge/proposals', {
      sourceFamilyspaceId: owner.familyspaceId,
    })
    expect(res.status()).toBe(400)
  })
})

/* ------------------------------------------------------------------ */
/* 3. Execute Merge                                                    */
/* ------------------------------------------------------------------ */

test.describe('Execute Merge', () => {
  let owner: TestUser
  let sourceSpaceId: string
  let approvedProposalId: string

  test.beforeAll(async () => {
    owner = await TestUser.signUp()
    const body = await owner.postJson<{ id: string }>('/api/familyspaces', {
      name: `MergeExecSrc ${Date.now().toString(36)}`,
    })
    sourceSpaceId = body.data!.id

    // Create and approve a proposal
    const createRes = await owner.postJson<{
      proposal: { id: string }
    }>('/api/family-merge/proposals', {
      sourceFamilyspaceId: sourceSpaceId,
    })
    const proposalId = createRes.data!.proposal.id

    await owner.api.patch(`/api/family-merge/proposals/${proposalId}`, {
      headers: { 'x-csrf-token': await owner.csrf() },
      data: { status: 'APPROVED' },
    })

    approvedProposalId = proposalId
  })

  test.afterAll(async () => {
    await owner.dispose()
  })

  test('executes an approved merge proposal', async () => {
    const body = await owner.postJson<{
      proposalId: string
      status: string
      result: {
        mergedPeople: number
        transferredStories: number
        transferredDocuments: number
        errors: string[]
      }
    }>('/api/family-merge/execute', {
      proposalId: approvedProposalId,
    })

    expect(body.success).toBe(true)
    expect(body.data?.status).toMatch(/^(MERGED|CONFLICT)$/)
    expect(typeof body.data?.result.mergedPeople).toBe('number')
    expect(typeof body.data?.result.transferredStories).toBe('number')
    expect(Array.isArray(body.data?.result.errors)).toBe(true)

    // The proposal status should now be MERGED or CONFLICT
    const getRes = await owner.api.get(
      `/api/family-merge/proposals/${approvedProposalId}`,
    )
    const getBody = await getRes.json()
    expect(['MERGED', 'CONFLICT']).toContain(getBody.data.proposal.status)
  })

  test('cannot execute a non-existent proposal', async () => {
    const res = await owner.postRaw('/api/family-merge/execute', {
      proposalId: 'nonexistent-id-00000',
    })
    expect(res.status()).toBe(404)
  })

  test('execute without proposalId returns 400', async () => {
    const res = await owner.postRaw('/api/family-merge/execute', {})
    expect(res.status()).toBe(400)
  })

  test('cross-tenancy: user B cannot execute user A merge', async () => {
    const outsider = await TestUser.signUp()
    const res = await outsider.postRaw('/api/family-merge/execute', {
      proposalId: approvedProposalId,
    })
    expect([403, 404]).toContain(res.status())
    await outsider.dispose()
  })

  test('requires OWNER role to execute merge', async () => {
    // Create an owner + an EDITOR member of the same space.
    // The EDITOR cannot execute a merge (OWNER required).
    const spaceOwner = await TestUser.signUp()
    const editorInfo = uniqueUserInfo('merge-editor')
    const editor = await TestUser.signUp({ info: editorInfo, onboard: false })

    // Owner invites editor
    const inviteBody = await spaceOwner.postJson<{ token: string }>(
      `/api/familyspaces/${spaceOwner.familyspaceId}/invite`,
      { email: editor.info.email, role: 'EDITOR' },
    )
    await editor.postJson(
      `/api/invites/${inviteBody.data!.token}/accept`,
      {},
    )

    // Editor creates a second familyspace so they have something to propose
    const editorSpaceBody = await editor.postJson<{ id: string }>(
      '/api/familyspaces',
      { name: `EditorSpace ${Date.now().toString(36)}` },
    )
    // Switch to owner's space so editor is operating in that context
    await editor.postJson(
      `/api/familyspaces/${spaceOwner.familyspaceId}/switch`,
      {},
    )

    // Editor creates a proposal (ADMIN is required to create, but EDITOR can't)
    // Actually, creating proposals requires ADMIN — so the editor can't even create.
    // Instead, let's verify the OWNER requirement on execute specifically.
    // The owner creates a proposal in their own space, and the editor tries
    // to execute it — which should fail because the editor isn't OWNER.
    const ownerSourceBody = await spaceOwner.postJson<{ id: string }>(
      '/api/familyspaces',
      { name: `OwnerExecSrc ${Date.now().toString(36)}` },
    )
    const ownerSourceId = ownerSourceBody.data!.id

    const proposalRes = await spaceOwner.postJson<{
      proposal: { id: string }
    }>('/api/family-merge/proposals', {
      sourceFamilyspaceId: ownerSourceId,
    })

    // Approve it
    await spaceOwner.api.patch(
      `/api/family-merge/proposals/${proposalRes.data!.proposal.id}`,
      {
        headers: { 'x-csrf-token': await spaceOwner.csrf() },
        data: { status: 'APPROVED' },
      },
    )

    // Now the editor (who is in the same space but only EDITOR) tries to execute
    const res = await editor.postRaw('/api/family-merge/execute', {
      proposalId: proposalRes.data!.proposal.id,
    })
    expect(res.status()).toBe(403)

    await spaceOwner.dispose()
    await editor.dispose()
  })

  test('cannot execute an unapproved proposal', async () => {
    const user = await TestUser.signUp()
    const srcBody = await user.postJson<{ id: string }>('/api/familyspaces', {
      name: `UnapprovedSrc ${Date.now().toString(36)}`,
    })
    const srcSpaceId = srcBody.data!.id

    // Create proposal but DO NOT approve
    const createRes = await user.postJson<{
      proposal: { id: string }
    }>('/api/family-merge/proposals', {
      sourceFamilyspaceId: srcSpaceId,
    })
    const proposalId = createRes.data!.proposal.id

    // Try to execute the pending proposal
    const res = await user.postRaw('/api/family-merge/execute', {
      proposalId,
    })
    expect(res.status()).toBe(404) // "not found or not approved"

    await user.dispose()
  })
})

/* ------------------------------------------------------------------ */
/* 4. Proposal Detail Management                                      */
/* ------------------------------------------------------------------ */

test.describe('Proposal Detail Management', () => {
  let user: TestUser
  let sourceSpaceId: string
  let proposalId: string

  test.beforeAll(async () => {
    user = await TestUser.signUp()
    const body = await user.postJson<{ id: string }>('/api/familyspaces', {
      name: `DetailSrc ${Date.now().toString(36)}`,
    })
    sourceSpaceId = body.data!.id

    const createRes = await user.postJson<{
      proposal: { id: string }
    }>('/api/family-merge/proposals', {
      sourceFamilyspaceId: sourceSpaceId,
    })
    proposalId = createRes.data!.proposal.id
  })

  test.afterAll(async () => {
    await user.dispose()
  })

  test('proposal detail includes personMatches with target/source info', async () => {
    const res = await user.api.get(`/api/family-merge/proposals/${proposalId}`)
    const body = await res.json()
    expect(body.success).toBe(true)

    const proposal = body.data.proposal
    expect(proposal.id).toBe(proposalId)
    expect(proposal.targetFamilyspace).toBeTruthy()
    expect(proposal.sourceFamilyspace).toBeTruthy()
    expect(proposal.proposedBy).toBeTruthy()
    expect(Array.isArray(proposal.personMatches)).toBe(true)

    // Each match should have targetPerson and sourcePerson
    for (const match of proposal.personMatches) {
      expect(match.targetPerson).toBeTruthy()
      expect(match.sourcePerson).toBeTruthy()
      expect(typeof match.matchScore).toBe('number')
      expect(match.isIncluded).toBe(true)
    }
  })

  test('can delete a PENDING proposal', async () => {
    const res = await user.api.delete(
      `/api/family-merge/proposals/${proposalId}`,
      {
        headers: { 'x-csrf-token': await user.csrf() },
      },
    )
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.message).toBe('Proposal deleted successfully')

    // Verify it's gone
    const getRes = await user.api.get(`/api/family-merge/proposals/${proposalId}`)
    expect(getRes.status()).toBe(404)
  })

  test('cannot delete a non-existent proposal', async () => {
    const res = await user.api.delete(
      '/api/family-merge/proposals/nonexistent-id-00000',
      {
        headers: { 'x-csrf-token': await user.csrf() },
      },
    )
    expect(res.status()).toBe(404)
  })
})

/* ------------------------------------------------------------------ */
/* 5. UI Tests                                                         */
/* ------------------------------------------------------------------ */

test.describe('Family Merge UI', () => {
  test('family merge page loads at /family-merge', async ({ page, user }) => {
    await page.goto('/family-merge', { waitUntil: 'networkidle' })

    // Page title should be visible
    await expect(
      page.getByText('Family Merge', { exact: false }).first(),
    ).toBeVisible({ timeout: 15000 })

    // Should show the merge proposals section
    await expect(
      page.getByText('Merge Proposals', { exact: false }).first(),
    ).toBeVisible({ timeout: 15000 })
  })

  test('family merge page shows "No merge proposals yet" when empty', async ({
    page,
    user,
  }) => {
    await page.goto('/family-merge', { waitUntil: 'networkidle' })

    // Should show empty state message
    await expect(
      page.getByText('No merge proposals yet'),
    ).toBeVisible({ timeout: 15000 })
  })

  test('family merge page shows "New Merge Proposal" button', async ({
    page,
    user,
  }) => {
    // First create a second familyspace so the button is enabled
    const body = await user.postJson<{ id: string }>('/api/familyspaces', {
      name: `UISrc ${Date.now().toString(36)}`,
    })

    await page.goto('/family-merge', { waitUntil: 'networkidle' })

    // Should show the "New Merge Proposal" button (enabled when other spaces exist)
    await expect(
      page.getByRole('button', { name: 'New Merge Proposal' }),
    ).toBeVisible({ timeout: 15000 })
  })

  test('family merge page shows description text', async ({ page, user }) => {
    await page.goto('/family-merge', { waitUntil: 'networkidle' })

    await expect(
      page.getByText(
        'Merge family trees from different familyspaces',
        { exact: false },
      ),
    ).toBeVisible({ timeout: 15000 })
  })
})

/* ------------------------------------------------------------------ */
/* 6. Edge cases                                                       */
/* ------------------------------------------------------------------ */

test.describe('Edge cases', () => {
  test('analyze requires ADMIN role', async () => {
    const owner = await TestUser.signUp()
    const viewerInfo = uniqueUserInfo('merge-viewer')
    const viewer = await TestUser.signUp({ info: viewerInfo, onboard: false })

    // Invite viewer to owner's space
    const inviteBody = await owner.postJson<{ token: string }>(
      `/api/familyspaces/${owner.familyspaceId}/invite`,
      { email: viewer.info.email, role: 'VIEWER' },
    )
    await viewer.postJson(`/api/invites/${inviteBody.data!.token}/accept`, {})

    // Switch viewer to owner's space
    await viewer.postJson(
      `/api/familyspaces/${owner.familyspaceId}/switch`,
      {},
    )

    // Viewer tries to analyze - should fail (needs ADMIN)
    const res = await viewer.postRaw('/api/family-merge/analyze', {
      sourceFamilyspaceId: owner.familyspaceId,
    })
    expect(res.status()).toBe(403)

    await owner.dispose()
    await viewer.dispose()
  })

  test('only the familyspace owner or ADMIN can propose a merge', async () => {
    const owner = await TestUser.signUp()
    const editorInfo = uniqueUserInfo('merge-editor2')
    const editor = await TestUser.signUp({ info: editorInfo, onboard: false })

    // Owner creates a second space
    const secondSpaceRes = await owner.postJson<{ id: string }>(
      '/api/familyspaces',
      { name: `OwnerSpace2 ${Date.now().toString(36)}` },
    )

    // Invite editor as EDITOR
    const inviteBody = await owner.postJson<{ token: string }>(
      `/api/familyspaces/${owner.familyspaceId}/invite`,
      { email: editor.info.email, role: 'EDITOR' },
    )
    await editor.postJson(`/api/invites/${inviteBody.data!.token}/accept`, {})

    await editor.postJson(
      `/api/familyspaces/${owner.familyspaceId}/switch`,
      {},
    )

    // Editor must also be ADMIN/OWNER of the source. They're neither on the
    // owner's second space, so this should fail.
    const res = await editor.postRaw('/api/family-merge/proposals', {
      sourceFamilyspaceId: secondSpaceRes.data!.id,
    })
    expect([403, 404]).toContain(res.status())

    await owner.dispose()
    await editor.dispose()
  })

  test('can only merge to OWNED familyspaces (source requirement)', async () => {
    // User must have ADMIN or OWNER role in the source familyspace
    const alice = await TestUser.signUp()
    const bob = await TestUser.signUp()

    // Alice tries to propose a merge using Bob's space as source
    // She doesn't have access to Bob's space
    const res = await alice.postRaw('/api/family-merge/proposals', {
      sourceFamilyspaceId: bob.familyspaceId,
    })
    expect([403, 404]).toContain(res.status())

    await alice.dispose()
    await bob.dispose()
  })

  test('analyze with missing body parameters returns 400', async ({ user }) => {
    const res = await user.postRaw('/api/family-merge/analyze', {})
    expect(res.status()).toBe(400)
  })
})
