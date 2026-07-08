import { request, type FullConfig } from '@playwright/test'

/**
 * Fails fast with a clear message when the app isn't running, instead of
 * letting every test time out individually.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL =
    (config.projects[0]?.use?.baseURL as string | undefined) ||
    process.env.PLAYWRIGHT_BASE_URL ||
    'https://localhost:4777'

  const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true })
  try {
    const res = await api.get('/login', { timeout: 15_000 })
    if (!res.ok()) {
      throw new Error(`Got HTTP ${res.status()} from ${baseURL}/login`)
    }
  } catch (error) {
    throw new Error(
      `E2E target is not reachable at ${baseURL}.\n` +
        `Start the app first (npm run dev) or point PLAYWRIGHT_BASE_URL at a running instance.\n` +
        `Underlying error: ${error instanceof Error ? error.message : String(error)}`,
    )
  } finally {
    await api.dispose()
  }
}
