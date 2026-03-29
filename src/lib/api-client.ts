// CSRF-aware API client for secure requests
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
  return data.csrfToken
}

/**
 * Get CSRF token (cached or fetch new)
 */
export async function getCSRFToken(): Promise<string> {
  // Return cached token if available
  if (csrfToken) {
    return csrfToken
  }

  // If fetch is in progress, wait for it
  if (tokenPromise) {
    return await tokenPromise
  }

  // Fetch new token
  tokenPromise = fetchCSRFToken()
  csrfToken = await tokenPromise
  tokenPromise = null
  
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
      
      // Add CSRF token to headers
      options.headers = {
        ...options.headers,
        'x-csrf-token': token,
      }
    } catch (error) {
      console.error('Failed to get CSRF token:', error)
      // For development, continue without token (will be rejected by server)
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CSRF protection failed')
      }
    }
  }

  return fetch(url, options)
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
