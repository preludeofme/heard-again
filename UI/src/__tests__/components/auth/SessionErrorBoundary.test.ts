import { ErrorBoundaryInner } from '@/components/auth/SessionErrorBoundary'
import * as sessionHandler from '@/lib/session-handler'

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('SessionErrorBoundary auth redirect guard', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('does not redirect on a session-shaped error while the NextAuth session is still valid', async () => {
    const boundary = new ErrorBoundaryInner({ children: null, router: null })
    const setStateSpy = jest.spyOn(boundary, 'setState').mockImplementation(() => undefined)
    const redirectSpy = jest.spyOn(sessionHandler, 'redirectToLogin').mockImplementation(() => undefined)
    jest.spyOn(sessionHandler, 'isActuallyUnauthenticated').mockResolvedValue(false)

    boundary.componentDidCatch(
      Object.assign(new Error('Authentication required'), { statusCode: 401 }),
      { componentStack: '' }
    )
    await flushPromises()

    expect(sessionHandler.isActuallyUnauthenticated).toHaveBeenCalled()
    expect(redirectSpy).not.toHaveBeenCalled()
    expect(setStateSpy).not.toHaveBeenCalledWith({ isRedirecting: true })
  })

  it('redirects on a session-shaped error only after NextAuth confirms no user', async () => {
    const boundary = new ErrorBoundaryInner({ children: null, router: null })
    const setStateSpy = jest.spyOn(boundary, 'setState').mockImplementation(() => undefined)
    const redirectSpy = jest.spyOn(sessionHandler, 'redirectToLogin').mockImplementation(() => undefined)
    jest.spyOn(sessionHandler, 'isActuallyUnauthenticated').mockResolvedValue(true)

    boundary.componentDidCatch(
      Object.assign(new Error('Authentication required'), { statusCode: 401 }),
      { componentStack: '' }
    )
    await flushPromises()

    expect(sessionHandler.isActuallyUnauthenticated).toHaveBeenCalled()
    expect(setStateSpy).toHaveBeenCalledWith({ isRedirecting: true })
    expect(redirectSpy).toHaveBeenCalledTimes(1)
  })
})
