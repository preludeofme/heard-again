// CSRF-aware API client for secure requests
import { fetchWithSessionHandling, handleApiError } from './session-handler'
let csrfToken: string | null = null
let tokenPromise: Promise<string> | null = null

/**
 * Fetch CSRF token from server
 */
async function fetchCSRFToken(): Promise<string> {
  const response = await fetch('/api/csrf-token')
  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token')
  }
  const data = await response.json()
  // Handle both wrapped {success, data} and direct {csrfToken} formats
  const csrfToken = data.data?.csrfToken || data.csrfToken
  return csrfToken
}

/**
 * Get CSRF token (cached or fetch new)
 */
export async function getCSRFToken(): Promise<string> {
  // If we already have a token and no fetch is in progress, return it
  if (csrfToken && !tokenPromise) {
    return csrfToken
  }
  
  // If fetch is in progress, wait for it
  if (tokenPromise) {
    return await tokenPromise
  }

  // Fetch new token
  tokenPromise = fetchCSRFToken()
  try {
    csrfToken = await tokenPromise
  } finally {
    tokenPromise = null
  }
  
  return csrfToken
}

/**
 * Reset CSRF token (call after login/logout)
 */
export function resetCSRFToken(): void {
  csrfToken = null
  tokenPromise = null
}

/**
 * Enhanced fetch wrapper with CSRF protection
 */
export async function fetchWithCSRF(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase()
  
  // Only add CSRF token to state-changing methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    try {
      const token = await getCSRFToken()

      // If token is undefined or invalid, throw an error
      if (!token || token === 'undefined' || token.length !== 64) {
        throw new Error(`Invalid CSRF token received: ${token ? 'length ' + token.length : 'null'}`)
      }
      
      // Add CSRF token to headers
      options.headers = {
        ...options.headers,
        'x-csrf-token': token,
      }
    } catch (error: any) {
      console.error('[fetchWithCSRF] CSRF token retrieval failed:', error)
      // For development, continue without token (will be rejected by server)
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`CSRF protection failed: ${error.message}`)
      }
    }
  }

  try {
    return await fetchWithSessionHandling(url, options)
  } catch (error: any) {
    console.error(`[fetchWithCSRF] Fetch execution failed for ${url}:`, error)
    throw error
  }
}

/**
 * FormData wrapper for file uploads with CSRF
 */
export async function fetchWithCSRFAndFormData(
  url: string,
  formData: FormData,
  options: RequestInit = {}
): Promise<Response> {
  return fetchWithCSRF(url, {
    ...options,
    method: 'POST',
    body: formData,
    // Don't set Content-Type header for FormData (browser sets it with boundary)
    headers: {
      ...options.headers,
    },
  })
}

/**
 * JSON wrapper with CSRF protection
 */
export async function fetchWithCSRFAndJSON(
  url: string,
  data: any,
  options: RequestInit = {}
): Promise<Response> {
  return fetchWithCSRF(url, {
    ...options,
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(data),
  })
}
