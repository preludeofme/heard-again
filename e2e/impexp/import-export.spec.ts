import { request } from '@playwright/test'
import { test, expect, TestUser } from './fixtures'
import { BASE_URL, uniqueFakeIp } from './helpers/api'

/**
 * Import / export features: API-driven export (PDF, JSON, GEDCOM, ZIP),
 * GEDCOM import (preview + full), JSON import, job tracking, cross-tenancy
 * isolation, and basic UI page loads.
 */

// ---------------------------------------------------------------------------
// Minimal valid GEDCOM string for preview / import tests.
// ---------------------------------------------------------------------------
const MINIMAL_GEDCOM = `0 HEAD
1 GEDC
2 VERS 5.5.1
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Test /Person/
1 SEX M
0 TRLR
`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a multipart FormData body with a GEDCOM file from a string. */
function gedcomFormData(content: string, filename = 'test.ged'): FormData {
  const fd = new FormData()
  fd.append('file', new Blob([content], { type: 'text/plain' }), filename)
  return fd
}

/** Create a multipart FormData body with a minimal JSON export payload. */
function jsonFormData(
  jsonObj: Record<string, unknown> = { version: 1, exportedAt: new Date().toISOString(), data: {} },
  filename = 'backup.json',
): FormData {
  const fd = new FormData()
  fd.append('file', new Blob([JSON.stringify(jsonObj)], { type: 'application/json' }), filename)
  return fd
}

/** Send a multipart POST through the user's authenticated API context. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function postMultipart(
  user: TestUser,
  url: string,
  form: FormData,
): Promise<{ status: number; body: any }> {
  const res = await user.api.post(url, {
    headers: { 'x-csrf-token': await user.csrf() },
    multipart: form,
  })
  let body: any = {}
  try {
    body = await res.json()
  } catch {
    // ignore parse failures for binary / empty responses
  }
  return { status: res.status(), body }
}

// ===========================================================================
//  Export
// ===========================================================================
test.describe('Export API', () => {
  test.describe('PDF export', () => {
    test('can export family data as PDF', async ({ user }) => {
      // First create a story so the export isn't completely empty.
      await user.createStory({ title: `Export Test ${Date.now().toString(36)}` })

      const res = await user.postRaw('/api/export/pdf', {})
      expect([200, 201]).toContain(res.status())

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data).toBeTruthy()
      expect(body.data.jobId).toBeTruthy()
      expect(body.data.status).toBe('COMPLETED')
      expect(body.data.exportType).toBe('PDF')
      expect(body.data.fileName).toMatch(/\.pdf$/)
      expect(typeof body.data.fileSizeBytes).toBe('number')
      expect(body.data.fileSizeBytes).toBeGreaterThan(0)
      expect(body.data.downloadUrl).toBeTruthy()
      expect(body.data.outputAssetId).toBeTruthy()
    })

    test('PDF export summary includes story count', async ({ user }) => {
      await user.createStory()
      const res = await user.postRaw('/api/export/pdf', {})
      const body = await res.json()
      expect(body.data.summary).toBeTruthy()
      expect(body.data.summary.stories).toBeGreaterThanOrEqual(1)
    })
  })

  test.describe('JSON export', () => {
    test('can export family data as JSON', async ({ user }) => {
      await user.createStory()

      const res = await user.postRaw('/api/export/json', {})
      expect([200, 201]).toContain(res.status())

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data).toBeTruthy()
      expect(body.data.jobId).toBeTruthy()
      expect(body.data.status).toBe('COMPLETED')
      expect(body.data.exportType).toBe('JSON')
      expect(body.data.fileName).toMatch(/\.json$/)
      expect(typeof body.data.fileSizeBytes).toBe('number')
      expect(body.data.fileSizeBytes).toBeGreaterThan(0)
      expect(body.data.downloadUrl).toBeTruthy()
      expect(body.data.summary).toBeTruthy()
      // The summary should list counts for the major entity types.
      expect(typeof body.data.summary.people).toBe('number')
      expect(typeof body.data.summary.stories).toBe('number')
    })
  })

  test.describe('GEDCOM export', () => {
    test('can export family tree as GEDCOM', async ({ user }) => {
      const res = await user.postRaw('/api/export/gedcom', {})
      expect([200, 201]).toContain(res.status())

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data).toBeTruthy()
      expect(body.data.jobId).toBeTruthy()
      expect(body.data.status).toBe('COMPLETED')
      expect(body.data.exportType).toBe('GEDCOM')
      expect(body.data.fileName).toMatch(/\.ged$/)
      expect(typeof body.data.fileSizeBytes).toBe('number')
      expect(body.data.downloadUrl).toBeTruthy()
      expect(body.data.summary).toBeTruthy()
      expect(typeof body.data.summary.people).toBe('number')
      expect(typeof body.data.summary.familyUnits).toBe('number')
    })
  })

  test.describe('ZIP export', () => {
    test('can export full archive as ZIP', async ({ user }) => {
      const res = await user.postRaw('/api/export/zip', {})
      expect([200, 201]).toContain(res.status())

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data).toBeTruthy()
      expect(body.data.jobId).toBeTruthy()
      expect(body.data.status).toBe('COMPLETED')
      expect(body.data.exportType).toBe('ZIP')
      expect(body.data.fileName).toMatch(/\.zip$/)
      expect(typeof body.data.fileSizeBytes).toBe('number')
      expect(body.data.downloadUrl).toBeTruthy()
    })
  })

  test.describe('Export job tracking', () => {
    test('export jobs are listed after creation', async ({ user }) => {
      // Trigger an export to create a job.
      await user.postRaw('/api/export/pdf', {})

      const res = await user.api.get('/api/export/jobs')
      expect(res.status()).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data?.jobs)).toBe(true)
      expect(body.data.jobs.length).toBeGreaterThanOrEqual(1)

      const job = body.data.jobs[0]
      expect(job.id).toBeTruthy()
      expect(job.exportType).toBeTruthy()
      expect(job.status).toBeTruthy()
      expect(job.createdAt).toBeTruthy()
    })

    test('can download a completed export job', async ({ user }) => {
      // Create a PDF export.
      const pdfRes = await user.postRaw('/api/export/pdf', {})
      const pdfBody = await pdfRes.json()
      const jobId = pdfBody.data.jobId

      const res = await user.api.get(`/api/export/jobs/${jobId}/download`)
      expect(res.status()).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.jobId).toBe(jobId)
      expect(body.data.downloadUrl).toBeTruthy()
      // The downloadUrl should point to the asset download endpoint.
      expect(body.data.downloadUrl).toMatch(/^\/api\/assets\//)
    })

    test('downloading a non-existent export job returns 404', async ({ user }) => {
      const res = await user.api.get('/api/export/jobs/non-existent-id/download')
      expect([404, 400]).toContain(res.status())
    })
  })
})

// ===========================================================================
//  Import
// ===========================================================================
test.describe('Import API', () => {
  test.describe('GEDCOM preview', () => {
    test('can preview a valid GEDCOM file', async ({ user }) => {
      const form = gedcomFormData(MINIMAL_GEDCOM)
      const { status, body } = await postMultipart(user, '/api/import/gedcom-preview', form)

      expect([200, 201]).toContain(status)
      expect(body.success).toBe(true)
      expect(body.data).toBeTruthy()
      expect(body.data.assetId).toBeTruthy()
      expect(body.data.preview).toBeTruthy()
      expect(Array.isArray(body.data.allIndividuals)).toBe(true)
      // Our minimal GEDCOM has one individual named "Test Person".
      expect(body.data.allIndividuals.length).toBeGreaterThanOrEqual(1)
      const person = body.data.allIndividuals.find(
        (i: { fullName?: string }) => i.fullName?.includes('Test') || i.fullName?.includes('Person'),
      )
      expect(person).toBeTruthy()
    })

    test('preview without a file returns 400', async ({ user }) => {
      const fd = new FormData()
      fd.append('not-file', 'nope')
      const { status, body } = await postMultipart(user, '/api/import/gedcom-preview', fd)
      expect(status).toBe(400)
      expect(body.success).toBe(false)
    })
  })

  test.describe('GEDCOM import', () => {
    test('can import a minimal GEDCOM file (multipart)', async ({ user }) => {
      const form = gedcomFormData(MINIMAL_GEDCOM)
      const { status, body } = await postMultipart(user, '/api/import/gedcom', form)

      // Returns 202 accepted (background job triggered).
      expect([200, 201, 202]).toContain(status)
      expect(body.success).toBe(true)
      expect(body.data).toBeTruthy()
      expect(body.data.jobId).toBeTruthy()
      expect(body.data.status).toMatch(/PENDING|PROCESSING|COMPLETED/)
      expect(body.data.sourceAssetId).toBeTruthy()
    })

    test('import without a file returns 400', async ({ user }) => {
      const fd = new FormData()
      const { status, body } = await postMultipart(user, '/api/import/gedcom', fd)
      expect(status).toBe(400)
      expect(body.success).toBe(false)
    })

    test('import with invalid file type returns error', async ({ user }) => {
      // Send a file with a disallowed MIME type.
      const fd = new FormData()
      fd.append('file', new Blob(['not gedcom content'], { type: 'image/png' }), 'fake.png')
      const { status, body } = await postMultipart(user, '/api/import/gedcom', fd)
      // Should reject — validation catches invalid types.
      expect([400, 422]).toContain(status)
      expect(body.success).toBe(false)
    })
  })

  test.describe('JSON import', () => {
    test('can import a minimal JSON file', async ({ user }) => {
      const exportPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        familyspace: { id: user.familyspaceId, name: 'Test' },
        data: {
          people: [
            { firstName: 'Imported', lastName: 'Person', personType: 'RELATIVE' },
          ],
          stories: [],
          assets: [],
        },
      }
      const form = jsonFormData(exportPayload)
      const { status, body } = await postMultipart(user, '/api/import/json', form)

      expect([200, 201]).toContain(status)
      expect(body.success).toBe(true)
      expect(body.data.jobId).toBeTruthy()
    })

    test('import with invalid JSON content returns 400', async ({ user }) => {
      const fd = new FormData()
      fd.append('file', new Blob(['not valid json {{{'], { type: 'application/json' }), 'bad.json')
      const { status, body } = await postMultipart(user, '/api/import/json', fd)
      expect(status).toBe(400)
      expect(body.success).toBe(false)
    })
  })

  test.describe('Import job tracking', () => {
    test('import jobs are listed after creation', async ({ user }) => {
      // Trigger a GEDCOM import.
      const form = gedcomFormData(MINIMAL_GEDCOM)
      await postMultipart(user, '/api/import/gedcom', form)

      const res = await user.api.get('/api/import/jobs')
      expect(res.status()).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data?.jobs)).toBe(true)
      expect(body.data.jobs.length).toBeGreaterThanOrEqual(1)

      const job = body.data.jobs[0]
      expect(job.id).toBeTruthy()
      expect(job.sourceType).toBeTruthy()
      expect(job.status).toBeTruthy()
    })

    test('can fetch a specific import job by id', async ({ user }) => {
      const form = gedcomFormData(MINIMAL_GEDCOM)
      const { body } = await postMultipart(user, '/api/import/gedcom', form)
      const jobId = body.data.jobId

      const res = await user.api.get(`/api/import/jobs/${jobId}`)
      expect(res.status()).toBe(200)

      const jobBody = await res.json()
      expect(jobBody.success).toBe(true)
      expect(jobBody.data.id).toBe(jobId)
      expect(jobBody.data.sourceType).toBe('GEDCOM')
      expect(jobBody.data.sourceAsset).toBeTruthy()
    })

    test('can fetch a realtime token for an import job', async ({ user }) => {
      const form = gedcomFormData(MINIMAL_GEDCOM)
      const { body } = await postMultipart(user, '/api/import/gedcom', form)
      const jobId = body.data.jobId

      const res = await user.api.get(`/api/import/jobs/${jobId}/realtime-token`)
      expect(res.status()).toBe(200)

      const tokenBody = await res.json()
      expect(tokenBody.success).toBe(true)
      // The token may be null if no trigger run was associated, or a string.
      expect(tokenBody.data).toBeTruthy()
      expect('token' in tokenBody.data).toBe(true)
    })

    test('fetching a non-existent import job returns 404', async ({ user }) => {
      const res = await user.api.get('/api/import/jobs/non-existent-id')
      expect([404, 400]).toContain(res.status())
    })
  })
})

// ===========================================================================
//  Authentication & access control
// ===========================================================================
test.describe('Export authentication', () => {
  const exportEndpoints = [
    '/api/export/pdf',
    '/api/export/json',
    '/api/export/gedcom',
    '/api/export/zip',
    '/api/export/jobs',
  ]

  for (const endpoint of exportEndpoints) {
    const method = endpoint === '/api/export/jobs' ? 'GET' : 'POST'

    test(`${method} ${endpoint} requires authentication`, async () => {
      const api = await request.newContext({
        baseURL: BASE_URL,
        ignoreHTTPSErrors: true,
        extraHTTPHeaders: { 'x-forwarded-for': uniqueFakeIp() },
      })
      const res =
        method === 'GET'
          ? await api.get(endpoint)
          : await api.post(endpoint, { data: {} })
      expect(res.status()).toBe(401)
      await api.dispose()
    })
  }
})

test.describe('Import authentication', () => {
  test('POST /api/import/gedcom requires authentication', async () => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { 'x-forwarded-for': uniqueFakeIp() },
    })
    const fd = gedcomFormData(MINIMAL_GEDCOM)
    const res = await api.post('/api/import/gedcom', { multipart: fd })
    expect(res.status()).toBe(401)
    await api.dispose()
  })

  test('POST /api/import/gedcom-preview requires authentication', async () => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { 'x-forwarded-for': uniqueFakeIp() },
    })
    const fd = gedcomFormData(MINIMAL_GEDCOM)
    const res = await api.post('/api/import/gedcom-preview', { multipart: fd })
    expect(res.status()).toBe(401)
    await api.dispose()
  })

  test('GET /api/import/jobs requires authentication', async () => {
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { 'x-forwarded-for': uniqueFakeIp() },
    })
    const res = await api.get('/api/import/jobs')
    expect(res.status()).toBe(401)
    await api.dispose()
  })
})

// ===========================================================================
//  Cross-tenancy isolation
// ===========================================================================
test.describe('Cross-familyspace export isolation', () => {
  let alice: TestUser
  let bob: TestUser
  let aliceJobId: string

  test.beforeAll(async () => {
    alice = await TestUser.signUp()
    bob = await TestUser.signUp()
    // Alice creates a story and exports to get a job id.
    await alice.createStory({ title: 'Alice Export Story' })
    const pdfRes = await alice.postRaw('/api/export/pdf', {})
    const pdfBody = await pdfRes.json()
    aliceJobId = pdfBody.data.jobId
  })

  test.afterAll(async () => {
    await alice.dispose()
    await bob.dispose()
  })

  test("user B cannot access user A's export jobs", async () => {
    const res = await bob.api.get('/api/export/jobs')
    expect(res.status()).toBe(200)
    const body = await res.json()
    const jobs: Array<{ id: string }> = body.data?.jobs ?? []
    const leaked = jobs.find((j) => j.id === aliceJobId)
    expect(leaked).toBeFalsy()
  })

  test("user B cannot download user A's export job", async () => {
    const res = await bob.api.get(`/api/export/jobs/${aliceJobId}/download`)
    expect([403, 404]).toContain(res.status())
  })
})

test.describe('Cross-familyspace import isolation', () => {
  let alice: TestUser
  let bob: TestUser
  let aliceImportJobId: string

  test.beforeAll(async () => {
    alice = await TestUser.signUp()
    bob = await TestUser.signUp()
    // Trigger a GEDCOM import for Alice.
    const form = gedcomFormData(MINIMAL_GEDCOM)
    const { body } = await postMultipart(alice, '/api/import/gedcom', form)
    aliceImportJobId = body.data.jobId
  })

  test.afterAll(async () => {
    await alice.dispose()
    await bob.dispose()
  })

  test("user B cannot access user A's import jobs", async () => {
    const res = await bob.api.get('/api/import/jobs')
    expect(res.status()).toBe(200)
    const body = await res.json()
    const jobs: Array<{ id: string }> = body.data?.jobs ?? []
    const leaked = jobs.find((j) => j.id === aliceImportJobId)
    expect(leaked).toBeFalsy()
  })

  test("user B cannot fetch user A's import job detail", async () => {
    const res = await bob.api.get(`/api/import/jobs/${aliceImportJobId}`)
    expect([403, 404]).toContain(res.status())
  })

  test("user B cannot fetch user A's import job realtime token", async () => {
    const res = await bob.api.get(`/api/import/jobs/${aliceImportJobId}/realtime-token`)
    expect([403, 404]).toContain(res.status())
  })
})

// ===========================================================================
//  UI tests
// ===========================================================================
test.describe('Export UI', () => {
  test('export page loads and shows options', async ({ page, user }) => {
    await page.goto('/export', { waitUntil: 'networkidle' })
    // The page should render something meaningful — a heading, a button, or a label.
    await expect(
      page
        .getByRole('heading')
        .or(page.getByText(/export/i))
        .first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('export-tree page loads', async ({ page, user }) => {
    await page.goto('/export-tree', { waitUntil: 'networkidle' })
    // The page should load without crashing.
    await expect(page.locator('body')).not.toBeEmpty()
  })
})

test.describe('Import UI', () => {
  test('import page loads', async ({ page, user }) => {
    await page.goto('/import', { waitUntil: 'networkidle' })
    // The page should load and show import-related content.
    await expect(
      page
        .getByRole('heading')
        .or(page.getByText(/import/i))
        .first(),
    ).toBeVisible({ timeout: 15_000 })
  })
})
