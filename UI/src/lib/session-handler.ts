import { logger } from '@/lib/logger'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import { ApiError } from './errors'

/**
 * Session expiration handler
 * 
 * This module provides utilities to detect when a session has expired
 * and automatically redirect the user to the login page.
 */

// Global flag to prevent multiple redirects
let isRedirecting = false

/**
 * Clear app-local authentication-related data.
 *
 * Do not clear browser cookies here. NextAuth owns its auth/session cookies,
 * and JavaScript cannot clear HttpOnly session cookies anyway. Expiring every
 * client-visible cookie can delete NextAuth helper cookies while leaving the
 * server session valid, creating a client/server split-brain auth state.
 */
export function clearAuthData(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('heard-again:recent-searches')
    localStorage.removeItem('heard-again:preferences')
  }
}

/**
 * Verify whether the canonical NextAuth session endpoint agrees that the user
 * is unauthenticated before taking global logout/redirect action.
 */
export async function isActuallyUnauthenticated(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/session', { credentials: 'include' })

    if (!response.ok) {
      return true
    }

    const session = await response.json()
    return !session?.user
  } catch (error) {
    logger.warn('Unable to verify NextAuth session before auth redirect', { error })
    return true
  }
}

/**
 * Redirect to login page with callback URL
 */
export function redirectToLogin(currentPath?: string): string | void {
  const loginUrl = currentPath 
    ? `/login?callbackUrl=${encodeURIComponent(currentPath)}`
    : '/login'

  if (isRedirecting) return loginUrl // Prevent multiple navigation attempts
  
  isRedirecting = true
  clearAuthData()
  
  if (typeof window !== 'undefined') {
    if (process.env.NODE_ENV === 'test') {
      return loginUrl
    }

    window.location.href = loginUrl
  }

  return loginUrl
}

/**
 * Check if an error indicates session expiration
 */
export function isSessionExpiredError(error: any): boolean {
  // Check HTTP status codes
  if (error?.statusCode === 401 || error?.status === 401) {
    return true
  }
  
  // Check error codes
  if (error?.code === 'UNAUTHORIZED' || error?.code === 'AUTH_REQUIRED') {
    return true
  }
  
  // Check error messages
  if (error?.message?.includes('Authentication required') ||
      error?.message?.includes('Not authenticated') ||
      error?.message?.includes('Session expired')) {
    return true
  }
  
  return false
}

/**
 * Hook to handle session expiration in components
 */
export function useSessionExpiration() {
  const router = useRouter()
  const redirectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    // Reset redirect flag when component mounts
    isRedirecting = false
    
    return () => {
      // Clear any pending timeout
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  const handleSessionExpired = (currentPath?: string) => {
    // Clear any existing timeout
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current)
    }
    
    // Add a small delay to allow any error messages to show
    redirectTimeoutRef.current = setTimeout(() => {
      redirectToLogin(currentPath || router.asPath)
    }, 1000)
  }

  return { handleSessionExpired }
}

/**
 * Enhanced fetch wrapper that handles session expiration
 */
export async function fetchWithSessionHandling(
  url: string,
  options: RequestInit = {},
  currentPath?: string
): Promise<Response> {
  console.log(`[fetchWithSessionHandling] Fetching: ${url}`, {
    method: options.method || 'GET',
    headers: options.headers ? Object.keys(options.headers) : [],
    credentials: options.credentials || 'default',
  })
  try {
    const response = await fetch(url, options)
    
    console.log(`[fetchWithSessionHandling] Response from ${url}:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    })
    
    // Check for 401 Unauthorized response. Confirm with NextAuth before a
    // global redirect so one endpoint-specific 401 does not poison client
    // session state while server auth is still valid.
    if (response.status === 401) {
      console.warn(`[fetchWithSessionHandling] 401 status from ${url}. Confirming auth status...`)
      if (await isActuallyUnauthenticated()) {
        console.warn(`[fetchWithSessionHandling] Confirmed unauthenticated. Redirecting to login...`)
        redirectToLogin(currentPath)
      } else {
        console.log(`[fetchWithSessionHandling] Session still valid despite 401. Skipping redirect.`)
      }
      return response
    }
    
    return response
  } catch (error: any) {
    console.error(`[fetchWithSessionHandling] Native fetch exception for ${url}:`, {
      message: error.message,
      name: error.name,
      stack: error.stack,
    })
    // Check if error indicates session expiration. For structured errors that
    // already contain an auth status we still confirm with NextAuth first.
    if (isSessionExpiredError(error)) {
      console.warn(`[fetchWithSessionHandling] Session expired error caught. Checking auth...`)
      if (await isActuallyUnauthenticated()) {
        redirectToLogin(currentPath)
      }
      throw error
    }
    
    throw error
  }
}

/**
 * API error handler that checks for session expiration
 */
export async function handleApiError(error: any, currentPath?: string): Promise<void> {
  if (isSessionExpiredError(error)) {
    if (await isActuallyUnauthenticated()) {
      redirectToLogin(currentPath)
    }
    return
  }
  
  // For other errors, you might want to show a toast or notification
  logger.error('API Error:', error)
}

/**
 * React hook for API calls with automatic session handling
 */
export function useApiWithSession() {
  const { handleSessionExpired } = useSessionExpiration()
  
  const apiCall = async <T>(
    apiFunction: () => Promise<T>,
    currentPath?: string
  ): Promise<T> => {
    try {
      return await apiFunction()
    } catch (error: any) {
      if (isSessionExpiredError(error)) {
        handleSessionExpired(currentPath)
        throw error
      }
      throw error
    }
  }
  
  return { apiCall }
}
