import { test, expect, TestUser } from './fixtures'

/**
 * Voice consent — the consent-first safety model around voice cloning.
 *
 * Consent records are plain database writes (no GPU/TTS dependency), so the
 * full grant / duplicate-guard / revoke / persistence lifecycle is exercised
 * against the real API. The consent *modal* UI only appears inside the voice
 * training flow, which needs the TTS service — see e2e/README.md for why that
 * part is deferred.
 */

test.describe('Voice consent lifecycle', () => {
  test('user can record self-consent for their own voice', async ({ user }) => {
    const body = await user.postJson<{ id: string; consentType: string }>('/api/voice/consent', {
      personId: user.personId,
      consentType: 'SELF',
      allowsGeneration: true,
    })
    expect(body.success).toBe(true)
    expect(body.data?.consentType).toBe('SELF')
    expect(body.data?.id).toBeTruthy()
  })

  test('granting consent twice does not create a duplicate', async ({ user }) => {
    await user.postJson('/api/voice/consent', {
      personId: user.personId,
      consentType: 'SELF',
    })
    const second = await user.postRaw('/api/voice/consent', {
      personId: user.personId,
      consentType: 'SELF',
    })
    expect(second.status()).toBe(200) // not 201 — the existing consent is returned
    const body = await second.json()
    expect(body.data?.message).toMatch(/already exists/i)
  })

  test('consent requires a person', async ({ user }) => {
    const res = await user.postRaw('/api/voice/consent', { consentType: 'SELF' })
    expect(res.status()).toBe(400)
  })

  test('consent type must be one of the recognised bases', async ({ user }) => {
    const res = await user.postRaw('/api/voice/consent', {
      personId: user.personId,
      consentType: 'SOMEONE_TOLD_ME_ITS_FINE',
    })
    expect(res.status()).toBe(400)
  })

  test("consent cannot be recorded for another familyspace's person", async ({ user }) => {
    const stranger = await TestUser.signUp()
    const res = await user.postRaw('/api/voice/consent', {
      personId: stranger.personId,
      consentType: 'FAMILY_ATTESTATION',
      attestationText: 'I am definitely allowed to do this',
    })
    expect([403, 404]).toContain(res.status())
    await stranger.dispose()
  })

  test('consent persists across a fresh login session', async ({ user }) => {
    await user.postJson('/api/voice/consent', {
      personId: user.personId,
      consentType: 'SELF',
    })

    // Log in again from scratch — the consent survives the old session.
    await user.login()
    const again = await user.postRaw('/api/voice/consent', {
      personId: user.personId,
      consentType: 'SELF',
    })
    expect(again.status()).toBe(200)
    expect((await again.json()).data?.message).toMatch(/already exists/i)
  })

  test('consent can be revoked', async ({ user }) => {
    const granted = await user.postJson<{ id: string }>('/api/voice/consent', {
      personId: user.personId,
      consentType: 'SELF',
    })
    const consentId = granted.data?.id
    expect(consentId).toBeTruthy()

    const revoked = await user.putRaw(`/api/voice/consent/${consentId}`, {})
    expect(revoked.ok()).toBe(true)
    expect((await revoked.json()).data?.revokedAt).toBeTruthy()

    // After revocation a new grant is possible again (201, not the duplicate path).
    const regrant = await user.postRaw('/api/voice/consent', {
      personId: user.personId,
      consentType: 'SELF',
    })
    expect(regrant.status()).toBe(201)
  })
})

test.describe('Consent-first UI', () => {
  test('voices lens is reachable and renders for a new family', async ({ page, user }) => {
    await page.goto('/legacy?lens=voices')
    // The voices lens renders without errors for a family that has no voice
    // profiles yet (exact empty-state copy is owned by the component).
    await expect(page.getByRole('button', { name: /voices/i })).toBeVisible()
    await expect(page.getByText(/error/i)).toHaveCount(0)
  })
})
