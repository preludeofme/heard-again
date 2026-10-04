import React from 'react'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'

const mockRouter = {
  query: {} as Record<string, string>,
  pathname: '/account',
  isReady: true,
  push: jest.fn(),
  replace: jest.fn(),
}

jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}))

jest.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/account/SecuritySettings', () => ({
  SecuritySettings: () => <div>Security settings</div>,
}))

jest.mock('@/components/account/DigitalLegacySettings', () => ({
  DigitalLegacySettings: () => <div>Digital legacy settings</div>,
}))

jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn(() => Promise.resolve(null)),
}))

jest.mock('@stripe/react-stripe-js', () => ({
  EmbeddedCheckoutProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  EmbeddedCheckout: () => <div>Stripe checkout</div>,
}))

const mockFetchWithCSRF = jest.fn()
jest.mock('@/lib/api-client', () => ({
  fetchWithCSRF: (...args: unknown[]) => mockFetchWithCSRF(...args),
}))

import AccountPage from '@/pages/account'

const CLOUD_STANDARD = {
  id: 'plan_mid',
  slug: 'cloud_mid',
  name: 'Cloud Standard',
  planType: 'CLOUD',
  pricing: { monthlyCents: 999, monthlyDisplay: '9.99' },
  entitlements: {
    tunnelEnabled: true,
    cloudGpuEnabled: true,
    generationMinutesIncluded: 60,
    storageQuotaBytes: 10 * 1024 * 1024 * 1024,
    memberQuota: 10,
    voiceProfileQuota: 3,
  },
}

const FREE_PLAN = {
  ...CLOUD_STANDARD,
  id: 'plan_free',
  slug: 'free',
  name: 'Free',
  planType: 'FREE',
  pricing: { monthlyCents: 0, monthlyDisplay: '0.00' },
}

const jsonOk = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })

function mockPageLoad(): void {
  global.fetch = jest.fn((input: any) => {
    const url = String(input)
    if (url.startsWith('/api/auth/session')) {
      // A Google signup: the Security tab does not exist for this user.
      return jsonOk({ user: { id: 'u1', name: 'A Owner', email: 'owner@example.com', image: null, role: 'USER', loginProvider: 'google' } })
    }
    if (url.startsWith('/api/billing/subscription')) {
      return jsonOk({ success: false })
    }
    if (url.startsWith('/api/billing/plans')) {
      return jsonOk({ success: true, data: { plans: [FREE_PLAN, CLOUD_STANDARD] } })
    }
    if (url.startsWith('/api/instance/status')) {
      return jsonOk({ success: true, data: { instance: null, tunnel: null, familyspaceRole: 'OWNER', familyspaceId: '' } })
    }
    if (url.startsWith('/api/billing/refund')) {
      return jsonOk({ success: true, data: { refunds: [] } })
    }
    return jsonOk({ success: false })
  }) as unknown as typeof fetch
}

describe('Account page — pending plan recovery (TRU-21)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRouter.query = {}
    mockPageLoad()
  })

  it('should show the picked plan on the Subscription tab when the buyer signed up with Google', async () => {
    mockRouter.query = { tab: 'subscription', pendingPlan: 'cloud_mid' }
    render(<AccountPage />)

    // The Subscription tab renders for a Google user (the Security tab does not).
    expect(await screen.findByText('Available Plans')).toBeInTheDocument()
    expect(screen.queryByText('Security settings')).not.toBeInTheDocument()

    const banner = await screen.findByText(/You picked the/i)
    expect(banner).toHaveTextContent('Cloud Standard')
    expect(banner).toHaveTextContent('$9.99/month after a 14-day free trial')
    expect(banner).toHaveTextContent(/Nothing has been charged yet/i)
  })

  it('should explain an unpurchasable plan instead of opening a confirm dialog on it', async () => {
    mockRouter.query = { tab: 'subscription', pendingPlan: 'cloud_lite' }
    render(<AccountPage />)

    const banner = await screen.findByText(/not open for cloud checkout yet/i)
    expect(banner).toHaveTextContent('Cloud Lite')
    expect(banner).toHaveTextContent(/Nothing has been charged/i)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockFetchWithCSRF).not.toHaveBeenCalled()
  })

  it('should show why checkout could not start inside the dialog when subscribe fails', async () => {
    mockRouter.query = { tab: 'subscription', pendingPlan: 'cloud_mid' }
    mockFetchWithCSRF.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Plan not found' }),
    })

    render(<AccountPage />)

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /Confirm Change/i }))

    await waitFor(() => {
      expect(within(dialog).getByText(/not open for cloud checkout/i)).toBeInTheDocument()
    })
    expect(within(dialog).getByText(/Nothing has been charged/i)).toBeInTheDocument()
    // The dialog stays open with a retry, instead of an Alert hidden behind the backdrop.
    expect(within(dialog).getByRole('button', { name: /Try Again/i })).toBeInTheDocument()
  })

  it('should only offer two-factor setup when the server actually asks for it', async () => {
    mockRouter.query = { tab: 'subscription', pendingPlan: 'cloud_mid' }
    mockFetchWithCSRF.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Requires OWNER role or higher' }),
    })

    render(<AccountPage />)

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /Confirm Change/i }))

    await waitFor(() => {
      expect(within(dialog).getByText(/Requires OWNER role or higher/)).toBeInTheDocument()
    })
    expect(within(dialog).queryByText(/two-factor/i)).not.toBeInTheDocument()
  })
})
