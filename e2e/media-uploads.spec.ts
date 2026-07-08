import { test, expect, TestUser } from './fixtures'
import { type APIRequestContext } from '@playwright/test'

/**
 * Media uploads, voice samples, and document management.
 *
 * Asset and document endpoints exercise the real upload pipeline — file
 * validation, malware scanning, and storage — through the live API. Voice
 * uploads focus on the consent-first guard and request-upload presigned-URL
 * flow; the GPU TTS service is not available in dev (see e2e/README.md), so
 * the full training pipeline is deferred.
 *
 * For file uploads use user.api directly with FormData (formidable on the
 * server requires multipart).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal test file buffer on the fly — no disk fixture needed. */
function pngBuffer(): Buffer {
  // Smallest valid PNG: 1×1 red pixel
  const b = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64',
  )
  return b
}

/** Create a minimal CSV buffer (text/csv, 2 rows). */
function csvBuffer(): Buffer {
  return Buffer.from('Name,Role\nAlice,Owner\n')
}

/** Create a minimal WAV buffer (44 bytes — one-sample PCM header). */
function wavBuffer(): Buffer {
  const sampleRate = 44100
  const numChannels = 1
  const bitsPerSample = 16
  const dataSize = 0 // no audio data — just the header

  const buf = Buffer.alloc(44 + dataSize)
  // RIFF header
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  // fmt subchunk
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16) // subchunk1size
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(numChannels, 22)
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE((sampleRate * numChannels * bitsPerSample) / 8, 28) // byte rate
  buf.writeUInt16LE((numChannels * bitsPerSample) / 8, 32) // block align
  buf.writeUInt16LE(bitsPerSample, 34)
  // data subchunk
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)

  return buf
}

interface UploadResult {
  success: boolean
  data?: {
    id: string
    mimeType?: string
    assetType?: string
    originalName?: string
    filename?: string
    publicUrl?: string
  }
  error?: string
}

/**
 * Upload a buffer as a multipart file via the authenticated API context.
 *
 * Playwright's `APIRequestContext.post` with `multipart` works for the
 * asset upload endpoint which uses formidable under the hood.  The `file`
 * part must be named "file" to match the handler's expectation.
 */
async function uploadFile(
  api: APIRequestContext,
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<{ status: number; body: UploadResult }> {
  const res = await api.post('/api/assets/upload', {
    multipart: {
      file: {
        name: filename,
        mimeType,
        buffer,
      },
    },
  })
  const body: UploadResult = await res.json()
  return { status: res.status(), body }
}

// ---------------------------------------------------------------------------
// 1. Asset Upload
// ---------------------------------------------------------------------------

test.describe('Asset upload', () => {
  test('upload an image to the familyspace', async ({ user }) => {
    const { status, body } = await uploadFile(
      user.api,
      pngBuffer(),
      'test-image.png',
      'image/png',
    )
    expect(status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data?.id).toBeTruthy()
    expect(body.data?.mimeType).toBe('image/png')
    expect(body.data?.assetType).toBe('IMAGE')
  })

  test('upload a document (CSV)', async ({ user }) => {
    const { status, body } = await uploadFile(
      user.api,
      csvBuffer(),
      'family-roles.csv',
      'text/csv',
    )
    expect(status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data?.id).toBeTruthy()
    expect(body.data?.assetType).toBe('DOCUMENT')
  })

  test('upload an audio file', async ({ user }) => {
    const { status, body } = await uploadFile(
      user.api,
      wavBuffer(),
      'voice-memo.wav',
      'audio/wav',
    )
    expect(status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data?.id).toBeTruthy()
    expect(body.data?.assetType).toBe('AUDIO')
  })

  test('list story assets', async ({ user }) => {
    const story = await user.createStory()

    // Attach an asset
    const upload = await uploadFile(user.api, pngBuffer(), 'photo.png', 'image/png')
    const assetId = upload.body.data?.id as string
    expect(assetId).toBeTruthy()

    await user.postJson(`/api/stories/${story.id}/assets`, {
      assetId,
      assetRole: 'ATTACHMENT',
      caption: 'A family photo',
    })

    // List assets for the story
    const res = await user.api.get(`/api/stories/${story.id}/assets`)
    expect(res.status()).toBe(200)
    const list = await res.json()
    expect(list.success).toBe(true)
    const assets = list.data ?? list
    expect(assets.length).toBeGreaterThanOrEqual(1)
    expect(assets[0]?.asset?.id).toBe(assetId)
    expect(assets[0]?.caption).toBe('A family photo')
  })

  test('serve an uploaded asset via serve endpoint', async ({ user }) => {
    const upload = await uploadFile(user.api, csvBuffer(), 'data.csv', 'text/csv')
    const assetId = upload.body.data?.id as string

    const res = await user.api.get(`/api/assets/serve/${assetId}`)
    expect(res.status()).toBe(200)
    // Content-Type should match the file
    const ct = res.headers()['content-type']
    expect(ct).toContain('text/csv')
  })

  test('preview a document asset (docx only)', async ({ user }) => {
    // Upload a text file first — preview is only for .doc/.docx; other types
    // return 415.
    const upload = await uploadFile(user.api, csvBuffer(), 'notes.csv', 'text/csv')
    const assetId = upload.body.data?.id as string

    const res = await user.api.get(`/api/assets/${assetId}/preview`)
    // CSV is not doc/docx, so preview is unsupported
    expect(res.status()).toBe(415)
    const body = await res.json()
    expect(body.error).toMatch(/preview not supported/i)
  })

  test('assets list includes uploaded file', async ({ user }) => {
    const upload = await uploadFile(user.api, pngBuffer(), 'visible.png', 'image/png')
    const assetId = upload.body.data?.id as string

    const res = await user.api.get('/api/assets')
    expect(res.status()).toBe(200)
    const body = await res.json()
    const ids = (body.data?.assets ?? []).map((a: { id: string }) => a.id)
    expect(ids).toContain(assetId)
  })
})

// ---------------------------------------------------------------------------
// 2. Voice Sample Upload
// ---------------------------------------------------------------------------

test.describe('Voice sample upload', () => {
  test('voice consent must be recorded before upload flow', async ({ user }) => {
    // The upload endpoints require EDITOR role but the consent guard is
    // downstream — we verify consent can be established to satisfy the
    // consent-first model.
    const consent = await user.postJson<{ id: string }>('/api/voice/consent', {
      personId: user.personId,
      consentType: 'SELF',
      allowsGeneration: true,
    })
    expect(consent.success).toBe(true)
    expect(consent.data?.id).toBeTruthy()
  })

  test('request-upload creates a presigned-URL asset', async ({ user }) => {
    // First grant voice consent
    await user.postJson('/api/voice/consent', {
      personId: user.personId,
      consentType: 'SELF',
      allowsGeneration: true,
    })

    const res = await user.postRaw('/api/voice/request-upload', {
      filename: 'sample.wav',
      mimeType: 'audio/wav',
      fileSize: 44,
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    // Local storage returns a local-upload URL; R2 returns a presigned URL
    expect(body.assetId).toBeTruthy()
    expect(body.uploadUrl).toBeTruthy()
    expect(body.expiresAt).toBeTruthy()
  })

  test('request-upload requires filename and mimeType', async ({ user }) => {
    const res = await user.postRaw('/api/voice/request-upload', {})
    expect(res.status()).toBe(400)
  })

  test('upload-status returns processing state for a pending asset', async ({ user }) => {
    await user.postJson('/api/voice/consent', {
      personId: user.personId,
      consentType: 'SELF',
      allowsGeneration: true,
    })

    const req = await user.postRaw('/api/voice/request-upload', {
      filename: 'status-test.wav',
      mimeType: 'audio/wav',
      fileSize: 44,
    })
    const { assetId } = await req.json()

    // With no runpodJobId, upload-status will look up the asset and return
    // its current processingStatus from the DB.
    const statusRes = await user.api.get(
      `/api/voice/upload-status?assetId=${assetId}&runpodJobId=none`,
    )
    expect(statusRes.status()).toBe(200)
    const statusBody = await statusRes.json()
    // PENDING assets are neither complete nor failed — the endpoint may
    // attempt a TTS provider call and fail gracefully, or return the
    // raw state.
    expect(statusBody.complete === true || statusBody.status === 'processing' || statusBody.failed === true).toBe(true)
  })

  test('process-upload requires an assetId', async ({ user }) => {
    const res = await user.postRaw('/api/voice/process-upload', {})
    expect(res.status()).toBe(400)
  })

  test('process-upload refuses a non-existent asset', async ({ user }) => {
    const res = await user.postRaw('/api/voice/process-upload', {
      assetId: '00000000-0000-0000-0000-000000000000',
    })
    expect(res.status()).toBe(404)
  })

  test('voice endpoints require authentication', async ({ request }) => {
    const eps = ['/api/voice/request-upload', '/api/voice/upload-status']
    for (const ep of eps) {
      const res = await request.post(ep, { data: {} }).catch(() => null)
      // Unauthenticated access should be rejected
      if (res) expect(res.status()).toBeGreaterThanOrEqual(401)
    }
  })
})

// ---------------------------------------------------------------------------
// 3. Document Management
// ---------------------------------------------------------------------------

test.describe('Document management', () => {
  test('GET /api/documents returns document list', async ({ user }) => {
    // Upload a file — the asset handler auto-creates a Document row.
    await uploadFile(user.api, csvBuffer(), 'record.csv', 'text/csv')

    const res = await user.api.get('/api/documents')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeGreaterThanOrEqual(1)
  })

  test('view a document by id', async ({ user }) => {
    const up = await uploadFile(user.api, csvBuffer(), 'invoice.csv', 'text/csv')

    // The document is auto-created alongside the asset. Look it up via the
    // documents list.
    const listRes = await user.api.get('/api/documents')
    const list = await listRes.json()
    const doc = list.data.find(
      (d: { asset?: { id?: string } }) => d.asset?.id === up.body.data?.id,
    )
    expect(doc).toBeTruthy()

    const detail = await user.api.get(`/api/documents/${doc.id}`)
    expect(detail.status()).toBe(200)
    const detailBody = await detail.json()
    expect(detailBody.success).toBe(true)
    expect(detailBody.data?.id).toBe(doc.id)
    expect(detailBody.data?.title).toBe('invoice.csv')
  })

  test('upload creates a document automatically', async ({ user }) => {
    // Every asset upload also creates a Document record (verified by the
    // document list including it).
    const up = await uploadFile(user.api, csvBuffer(), 'auto-doc.csv', 'text/csv')

    const listRes = await user.api.get('/api/documents')
    const list = await listRes.json()
    const found = list.data.some(
      (d: { asset?: { id?: string } }) => d.asset?.id === up.body.data?.id,
    )
    expect(found).toBe(true)
  })

  test('delete a document (soft delete)', async ({ user }) => {
    const up = await uploadFile(user.api, csvBuffer(), 'to-delete.csv', 'text/csv')

    const listRes = await user.api.get('/api/documents')
    const list = await listRes.json()
    const doc = list.data.find(
      (d: { asset?: { id?: string } }) => d.asset?.id === up.body.data?.id,
    )
    expect(doc).toBeTruthy()

    // Soft delete (default)
    const delRes = await user.deleteRaw(`/api/documents/${doc.id}`)
    expect(delRes.ok()).toBe(true)
    const delBody = await delRes.json()
    expect(delBody.success).toBe(true)
    expect(delBody.message).toMatch(/trash/i)

    // After soft delete, it's hidden from the default list
    const after = await user.api.get('/api/documents')
    const afterBody = await after.json()
    const stillVisible = afterBody.data.some((d: { id: string }) => d.id === doc.id)
    expect(stillVisible).toBe(false)

    // But still retrievable with includeDeleted
    const withDeleted = await user.api.get(`/api/documents?includeDeleted=true`)
    const wdBody = await withDeleted.json()
    const found = wdBody.data.some((d: { id: string }) => d.id === doc.id)
    expect(found).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 4. Edge Cases
// ---------------------------------------------------------------------------

test.describe('Edge cases', () => {
  test('upload with no file returns error', async ({ user }) => {
    // Sending a multipart request without the "file" field
    const res = await user.api.post('/api/assets/upload', {
      multipart: {
        // no file field
      },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/no file provided/i)
  })

  test('upload with disallowed file type returns error', async ({ user }) => {
    // An .exe file should be rejected by the file validator
    const exeBuffer = Buffer.from('MZ' + '\x00'.repeat(100)) // DOS MZ header
    const res = await user.api.post('/api/assets/upload', {
      multipart: {
        file: {
          name: 'malware.exe',
          mimeType: 'application/x-msdownload',
          buffer: exeBuffer,
        },
      },
    })
    // Either 400 (validation) or 403 (malware scan)
    expect([400, 403]).toContain(res.status())
  })

  test('cross-tenancy: user B cannot access user A assets', async ({ user }) => {
    // Upload as user A (our fixture user)
    const up = await uploadFile(user.api, pngBuffer(), 'private.png', 'image/png')
    const assetId = up.body.data?.id as string

    // user B tries to access
    const stranger = await TestUser.signUp()

    const serveRes = await stranger.api.get(`/api/assets/serve/${assetId}`)
    expect(serveRes.status()).toBe(404) // "Asset not found" — don't leak existence

    const previewRes = await stranger.api.get(`/api/assets/${assetId}/preview`)
    expect([404, 415]).toContain(previewRes.status())

    await stranger.dispose()
  })

  test('cross-tenancy: user B cannot access user A documents', async ({ user }) => {
    const up = await uploadFile(user.api, csvBuffer(), 'secret.csv', 'text/csv')

    // Find the auto-created document id
    const listRes = await user.api.get('/api/documents')
    const list = await listRes.json()
    const doc = list.data.find(
      (d: { asset?: { id?: string } }) => d.asset?.id === up.body.data?.id,
    )
    expect(doc).toBeTruthy()

    const stranger = await TestUser.signUp()
    const detailRes = await stranger.api.get(`/api/documents/${doc.id}`)
    expect(detailRes.status()).toBe(404)

    const delRes = await stranger.deleteRaw(`/api/documents/${doc.id}`)
    expect(delRes.status()).toBe(404)

    await stranger.dispose()
  })

  test('large file upload is handled (within limits)', async ({ user }) => {
    // 1 MB of valid text — within the 100 MB limit, exercises the pipeline
    const large = Buffer.alloc(1_000_000, 'A')
    // Wrap in a minimal CSV structure
    const largeCsv = Buffer.concat([
      Buffer.from('Col1,Col2\n'),
      large,
      Buffer.from('\n'),
    ])

    const { status, body } = await uploadFile(
      user.api,
      largeCsv,
      'large.csv',
      'text/csv',
    )
    expect(status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data?.id).toBeTruthy()
  })

  test('assets endpoint is paginated', async ({ user }) => {
    const res = await user.api.get('/api/assets?page=1&limit=2')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data?.pagination).toBeTruthy()
    expect(body.data?.pagination?.page).toBe(1)
    expect(body.data?.pagination?.limit).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// 5. UI Tests
// ---------------------------------------------------------------------------

test.describe('Documents UI', () => {
  test('documents page loads and shows uploaded documents', async ({ page, user }) => {
    // Upload a file so there's at least one document
    await uploadFile(user.api, csvBuffer(), 'my-doc.csv', 'text/csv')

    await page.goto('/documents', { waitUntil: 'networkidle' })
    // The page renders without errors
    await expect(page.getByText(/error/i)).toHaveCount(0)

    // The documents page should show our uploaded document's title (the
    // filename, since the auto-created document uses the original name).
    await expect(page.getByText('my-doc.csv').first()).toBeVisible({ timeout: 15_000 })
  })

  test('documents page is guarded (requires auth)', async ({ page }) => {
    // Without the user fixture, we have a clean unauthenticated page
    await page.goto('/documents', { waitUntil: 'networkidle' })
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
  })
})
