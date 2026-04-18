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
 * Clear all authentication-related data
 */
export function clearAuthData(): void {
  // Clear session cookies (client-side only)
  document.cookie.split(';').forEach(cookie => {
    const eqPos = cookie.indexOf('=')
    const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
  })
  
  // Clear localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('heard-again:recent-searches')
    localStorage.removeItem('heard-again:preferences')
  }
}

/**
 * Redirect to login page with callback URL
 */
export function redirectToLogin(currentPath?: string): void {
  if (isRedirecting) return // Prevent multiple redirects
  
  isRedirecting = true
  clearAuthData()
  
  const loginUrl = currentPath 
    ? `/login?callbackUrl=${encodeURIComponent(currentPath)}`
    : '/login'
  
  if (typeof window !== 'undefined') {
    window.location.href = loginUrl
  }
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
  try {
    const response = await fetch(url, options)
    
    // Check for 401 Unauthorized response
    if (response.status === 401) {
      redirectToLogin(currentPath)
      return response
    }
    
    return response
  } catch (error: any) {
    // Check if error indicates session expiration
    if (isSessionExpiredError(error)) {
      redirectToLogin(currentPath)
      throw error
    }
    
    throw error
  }
}

/**
 * API error handler that checks for session expiration
 */
export function handleApiError(error: any, currentPath?: string): void {
  if (isSessionExpiredError(error)) {
    redirectToLogin(currentPath)
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
