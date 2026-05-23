import {
  clearAuthData,
  fetchWithSessionHandling,
  handleApiError,
  redirectToLogin,
} from '@/lib/session-handler'

function mockResponse(body: unknown, status: number) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  } as any
}

describe('session-handler split-brain safeguards', () => {
  let cookieValue = ''

  beforeEach(() => {
    localStorage.clear()
    cookieValue = 'next-auth.csrf-token=csrf-value; csrf-token=app-csrf-value; heard-again-pref=keep-me'
    jest.spyOn(document, 'cookie', 'get').mockImplementation(() => cookieValue)
    jest.spyOn(document, 'cookie', 'set').mockImplementation((value: string) => {
      if (value.includes('expires=Thu, 01 Jan 1970')) {
        const name = value.split('=')[0]?.trim()
        cookieValue = cookieValue
          .split('; ')
          .filter((cookie) => !cookie.startsWith(`${name}=`))
          .join('; ')
      } else {
        cookieValue = value
      }
    })
    ;(global as any).fetch = jest.fn()
  })

  afterEach(() => {
    delete (global as any).fetch
    jest.restoreAllMocks()
  })

  it('clears app-local auth state without deleting browser-visible cookies', () => {
    localStorage.setItem('heard-again:recent-searches', '[]')
    localStorage.setItem('heard-again:preferences', '{}')
    localStorage.setItem('unrelated-app-state', 'preserve')

    clearAuthData()

    expect(localStorage.getItem('heard-again:recent-searches')).toBeNull()
    expect(localStorage.getItem('heard-again:preferences')).toBeNull()
    expect(localStorage.getItem('unrelated-app-state')).toBe('preserve')
    expect(document.cookie).toContain('next-auth.csrf-token=csrf-value')
    expect(document.cookie).toContain('csrf-token=app-csrf-value')
    expect(document.cookie).toContain('heard-again-pref=keep-me')
  })

  it('does not globally redirect on a protected endpoint 401 while NextAuth session is still valid', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce(mockResponse('denied', 401))
      .mockResolvedValueOnce(mockResponse({ user: { id: 'user-1', email: 'ryan@example.com' } }, 200))

    const response = await fetchWithSessionHandling('/api/some-endpoint', { credentials: 'include' }, '/family-tree')

    expect(response.status).toBe(401)
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/some-endpoint', { credentials: 'include' })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/session', { credentials: 'include' })
    expect(document.cookie).toContain('next-auth.csrf-token=csrf-value')
  })

  it('redirects to login on fetch 401 when NextAuth session endpoint has no user', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce(mockResponse('denied', 401))
      .mockResolvedValueOnce(mockResponse({}, 200))

    await fetchWithSessionHandling('/api/some-endpoint', {}, '/family-tree')

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/session', { credentials: 'include' })
    expect(redirectToLogin('/family-tree')).toBe('/login?callbackUrl=%2Ffamily-tree')
    expect(redirectToLogin()).toBe('/login')
  })

  it('does not redirect from handleApiError on a structured 401 while NextAuth session is still valid', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValueOnce(mockResponse({ user: { id: 'user-1' } }, 200))

    await handleApiError({ statusCode: 401, message: 'Authentication required' }, '/family-tree')

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', { credentials: 'include' })
  })

  it('redirects from handleApiError when a structured 401 is confirmed unauthenticated', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValueOnce(mockResponse({}, 200))

    await handleApiError({ statusCode: 401, message: 'Authentication required' }, '/family-tree')

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', { credentials: 'include' })
    expect(redirectToLogin('/family-tree')).toBe('/login?callbackUrl=%2Ffamily-tree')
    expect(redirectToLogin()).toBe('/login')
  })

  it('does not treat authorization failures as session expiration', async () => {
    await handleApiError({ statusCode: 403, message: 'Not authorized' }, '/family-tree')

    expect(global.fetch).not.toHaveBeenCalled()
  })
})
