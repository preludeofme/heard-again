import { test, expect } from './fixtures'

/**
 * Public pages: no authentication required. Covers the landing page,
 * documentation/guide pages, legacy terms, and the 500 error page.
 */

const PUBLIC_PAGES = [
  { route: '/', label: 'landing page' },
  { route: '/self-hosting', label: 'self-hosting' },
  { route: '/setup-guide', label: 'setup guide' },
  { route: '/tunnel-setup', label: 'tunnel setup' },
  { route: '/terms-legacy', label: 'terms legacy' },
]

test.describe('Landing page', () => {
  test('renders hero section with branding and CTA', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 45_000 })

    // Branding
    await expect(page.getByText('Heard Again').first()).toBeVisible()
    // Hero headline
    await expect(
      page.getByRole('heading', { name: /preserve|family|stories|voices|legacy/i, level: 1 }),
    ).toBeVisible({ timeout: 15_000 })
    // CTA button
    await expect(
      page.getByRole('link', { name: 'Get Started' }),
    ).toBeVisible()
    // Pricing section
    await expect(page.getByText(/free|pricing|plan/i).first()).toBeVisible()
  })

  test('has links to sign up', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 45_000 })

    const signUpLinks = page.getByRole('link', { name: /get started|sign up|create.*account|start preserving/i })
    await expect(signUpLinks.first()).toBeVisible()
  })

  test('final CTA banner links to signup', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 45_000 })

    await expect(
      page.getByRole('link', { name: /start preserving/i }),
    ).toBeVisible()
  })
})

test.describe('Self-hosting page', () => {
  test('renders with heading and content', async ({ page }) => {
    await page.goto('/self-hosting', { waitUntil: 'networkidle', timeout: 45_000 })

    await expect(
      page.getByRole('heading', { name: 'Self-Hosting Setup' }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/configure your local instance/i)).toBeVisible()
  })
})

test.describe('Setup guide page', () => {
  test('renders with heading and mode cards', async ({ page }) => {
    await page.goto('/setup-guide', { waitUntil: 'networkidle', timeout: 45_000 })

    await expect(
      page.getByRole('heading', { name: 'Self-Hosting Setup Guide' }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Lite (No-AI) Setup')).toBeVisible()
    await expect(page.getByText('Full AI Setup')).toBeVisible()
  })
})

test.describe('Tunnel setup page', () => {
  test('renders with heading and tunnel mode controls', async ({ page }) => {
    await page.goto('/tunnel-setup', { waitUntil: 'networkidle', timeout: 45_000 })

    await expect(
      page.getByRole('heading', { name: /tunnel/i }).first(),
    ).toBeVisible({ timeout: 15_000 })
    // Mode tabs — Named Tunnel is the default
    await expect(page.getByRole('tab', { name: /named tunnel/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /quick tunnel/i })).toBeVisible()
  })
})

test.describe('Terms legacy page', () => {
  test('renders with heading and link to current terms', async ({ page }) => {
    await page.goto('/terms-legacy', { waitUntil: 'networkidle', timeout: 45_000 })

    await expect(
      page.getByRole('heading', { name: 'Terms of Legacy' }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByRole('link', { name: /view current terms/i }),
    ).toBeVisible()
  })
})

test.describe('Error page (500)', () => {
  test('renders error page with status code and home link', async ({ page }) => {
    // Trigger a 500 by navigating to a route that throws
    // The app renders the custom 500 page via _error.tsx
    await page.goto('/500', { waitUntil: 'networkidle', timeout: 45_000 })

    await expect(page.getByText('500')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/something went wrong|an error occurred/i)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go home' })).toBeVisible()
  })
})

test.describe('All public pages render without JS errors', () => {
  for (const { route, label } of PUBLIC_PAGES) {
    test(`${label} page renders without console errors`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (err) => errors.push(err.message))

      await page.goto(route, { waitUntil: 'networkidle', timeout: 45_000 })

      expect(errors).toEqual([])
    })
  }
})
