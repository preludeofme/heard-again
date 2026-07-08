import { request, type APIRequestContext } from '@playwright/test'

/**
 * API-level test-data factory.
 *
 * Every test creates its own isolated user (and familyspace) through the real
 * public signup API, so tests never depend on pre-seeded or production data.
 * Emails use a reserved, deterministic pattern — `e2e-<prefix>-<runId>@heardagain.test`
 * — so leftover records are easy to find and purge (see e2e/cleanup-test-data.mjs).
 */

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://localhost:4777'
export const TEST_EMAIL_DOMAIN = 'heardagain.test'
export const DEFAULT_PASSWORD = 'E2E-Test-Passw0rd!'

let userCounter = 0
let ipCounter = 0

/**
 * Unique synthetic client IP per test context.
 *
 * The app rate-limits per client IP (via x-forwarded-for). A full suite run
 * from one machine would otherwise exhaust the 15-minute buckets and turn
 * later tests into false 429 failures. Each simulated user/browser gets its
 * own IP, which mirrors reality: real users don't share one address.
 */
export function uniqueFakeIp(): string {
  const n = ++ipCounter
  const worker = (process.pid % 200) + 20
  return `10.${worker}.${Math.floor(n / 250) % 250}.${(n % 250) + 1}`
}

export interface TestUserInfo {
  email: string
  password: string
  firstName: string
  lastName: string
  displayName: string
  familyName: string
}

/** Deterministic-but-unique identity for one test user. Never collides across runs. */
export function uniqueUserInfo(prefix = 'user'): TestUserInfo {
  const runId = `${Date.now().toString(36)}-${process.pid.toString(36)}-${++userCounter}`
  const firstName = `E2E${prefix.charAt(0).toUpperCase()}${prefix.slice(1)}`
  const lastName = `Run${runId.replace(/-/g, '')}`
  return {
    email: `e2e-${prefix}-${runId}@${TEST_EMAIL_DOMAIN}`,
    password: DEFAULT_PASSWORD,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    familyName: `${firstName} Family ${runId}`,
  }
}

interface ApiEnvelope<T = Record<string, unknown>> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

export interface SignUpOptions {
  /** Complete onboarding (family name + self person) right after signup. Default true. */
  onboard?: boolean
  /** Override the generated identity. */
  info?: TestUserInfo
}

/**
 * A logged-in test user with an authenticated API context.
 *
 * `storageState()` yields the NextAuth session cookies so browser contexts can
 * reuse the same login without driving the UI.
 */
export class TestUser {
  private csrfToken: string | null = null

  private constructor(
    readonly api: APIRequestContext,
    readonly info: TestUserInfo,
    readonly fakeIp: string,
  ) {}

  /** The user's own Person record id — set once onboarding has completed. */
  personId: string | null = null
  familyspaceId: string | null = null

  static async signUp(options: SignUpOptions = {}): Promise<TestUser> {
    const info = options.info ?? uniqueUserInfo()
    const fakeIp = uniqueFakeIp()
    const api = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { 'x-forwarded-for': fakeIp },
    })
    const user = new TestUser(api, info, fakeIp)

    const signupRes = await api.post('/api/auth/signup', {
      data: {
        email: info.email,
        password: info.password,
        firstName: info.firstName,
        lastName: info.lastName,
      },
    })
    if (signupRes.status() !== 201) {
      throw new Error(`Test-user signup failed (${signupRes.status()}): ${await signupRes.text()}`)
    }
    const signupBody = (await signupRes.json()) as ApiEnvelope<{
      user?: { defaultFamilyspaceId?: string }
    }>
    user.familyspaceId = signupBody.data?.user?.defaultFamilyspaceId ?? null

    await user.login()

    if (options.onboard !== false) {
      await user.completeOnboarding()
    }
    return user
  }

  /** Authenticate through the real NextAuth credentials callback. */
  async login(): Promise<void> {
    const csrfRes = await this.api.get('/api/auth/csrf')
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }
    const loginRes = await this.api.post('/api/auth/callback/credentials', {
      form: {
        csrfToken,
        email: this.info.email,
        password: this.info.password,
        json: 'true',
      },
    })
    if (!loginRes.ok()) {
      throw new Error(`Test-user login failed (${loginRes.status()})`)
    }
    const session = (await (await this.api.get('/api/auth/session')).json()) as {
      user?: { email?: string }
    }
    if (session?.user?.email !== this.info.email) {
      throw new Error(`Login did not establish a session for ${this.info.email}`)
    }
    // App CSRF token is tied to the session cookie — refresh it after login.
    this.csrfToken = null
  }

  /** Family name + self person, same as finishing the onboarding wizard. */
  async completeOnboarding(): Promise<void> {
    const body = await this.postJson<{ person?: { id: string }; familyspace?: { id: string } }>(
      '/api/auth/complete-onboarding',
      {
        familyName: this.info.familyName,
        firstName: this.info.firstName,
        lastName: this.info.lastName,
      },
    )
    this.personId = body.data?.person?.id ?? null
    this.familyspaceId = body.data?.familyspace?.id ?? this.familyspaceId
  }

  /** Double-submit CSRF token for the app's mutation endpoints. */
  async csrf(): Promise<string> {
    if (this.csrfToken) return this.csrfToken
    const res = await this.api.get('/api/csrf-token')
    const body = (await res.json()) as ApiEnvelope<{ csrfToken: string }>
    const token = body.data?.csrfToken
    if (!token) throw new Error(`Could not obtain CSRF token (${res.status()})`)
    this.csrfToken = token
    return token
  }

  async postJson<T>(url: string, data: unknown): Promise<ApiEnvelope<T>> {
    const res = await this.api.post(url, {
      headers: { 'x-csrf-token': await this.csrf() },
      data,
    })
    const body = (await res.json()) as ApiEnvelope<T>
    if (!res.ok()) {
      throw new Error(`POST ${url} failed (${res.status()}): ${JSON.stringify(body)}`)
    }
    return body
  }

  /** POST without throwing — for tests asserting on error responses. */
  async postRaw(url: string, data: unknown) {
    return this.api.post(url, { headers: { 'x-csrf-token': await this.csrf() }, data })
  }

  async putRaw(url: string, data: unknown) {
    return this.api.put(url, { headers: { 'x-csrf-token': await this.csrf() }, data })
  }

  async deleteRaw(url: string) {
    return this.api.delete(url, { headers: { 'x-csrf-token': await this.csrf() } })
  }

  /** Create a story owned by this user's familyspace. Returns the story id. */
  async createStory(overrides: Record<string, unknown> = {}): Promise<{ id: string }> {
    if (!this.personId) throw new Error('createStory requires an onboarded user (personId missing)')
    const body = await this.postJson<{ id: string }>('/api/stories', {
      title: `E2E Story ${Date.now().toString(36)}`,
      content: '<p>Created by the E2E suite.</p>',
      subjectId: this.personId,
      storyType: 'MEMORY',
      status: 'PUBLISHED',
      visibility: 'FAMILY_ONLY',
      ...overrides,
    })
    if (!body.data?.id) throw new Error(`Story creation returned no id: ${JSON.stringify(body)}`)
    return { id: body.data.id }
  }

  /** Session cookies for reuse in a browser context. */
  async storageState() {
    return this.api.storageState()
  }

  async dispose(): Promise<void> {
    await this.api.dispose()
  }
}
