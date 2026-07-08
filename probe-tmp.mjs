import { chromium, request } from '@playwright/test'

const BASE = 'https://localhost:4777'
const runId = Date.now()
const email = `e2e-probe-tree-${runId}@heardagain.test`
const password = 'E2EProbePass!23'

const api = await request.newContext({ baseURL: BASE, ignoreHTTPSErrors: true })
await api.post('/api/auth/signup', { data: { email, password, firstName: 'Tree', lastName: `Probe${runId}` } })
const { csrfToken } = await (await api.get('/api/auth/csrf')).json()
await api.post('/api/auth/callback/credentials', { form: { csrfToken, email, password, json: 'true' } })
const csrfBody = await (await api.get('/api/csrf-token')).json()
const appCsrf = csrfBody.data?.csrfToken
await api.post('/api/auth/complete-onboarding', {
  headers: { 'x-csrf-token': appCsrf },
  data: { familyName: `Tree Family ${runId}`, firstName: 'Tree', lastName: `Probe${runId}` },
})

const browser = await chromium.launch()
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, storageState: await api.storageState() })
const page = await ctx.newPage()
await page.goto(BASE + '/family-tree', { waitUntil: 'networkidle' })

const name = `Tree Probe${runId}`
await page.getByRole('application').getByText(name, { exact: true }).first().click()
for (let i = 0; i < 15; i++) {
  await page.waitForTimeout(2000)
  const txt = await page.getByRole('dialog').first().textContent().catch(() => null)
  console.log(`t=${(i+1)*2}s dialog text:`, txt === null ? 'no dialog' : JSON.stringify(txt.slice(0, 120)))
  if (txt) break
}
await page.screenshot({ path: '/tmp/probe-tree-click.png' })
await browser.close()
await api.dispose()
