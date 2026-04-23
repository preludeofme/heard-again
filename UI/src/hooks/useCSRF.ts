import { useState, useCallback, useEffect } from 'react'

/**
 * Hook to manage CSRF tokens for state-changing requests.
 * Fetches the token once and provides it for subsequent requests.
 */
export function useCSRF() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchToken = useCallback(async () => {
    if (csrfToken && !error) return csrfToken
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/csrf-token')
      if (!response.ok) {
        throw new Error('Failed to fetch CSRF token')
      }
      
      const { data } = await response.json()
      setCsrfToken(data.csrfToken)
      setIsLoading(false)
      return data.csrfToken
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown CSRF error')
      setError(error)
      setIsLoading(false)
      throw error
    }
  }, [csrfToken, error])

  // Optional: Pre-fetch token on mount
  useEffect(() => {
    fetchToken().catch(() => {
      // Ignore initial pre-fetch errors, will retry on use
    })
  }, [fetchToken])

  return {
    csrfToken,
    fetchToken,
    isLoading,
    error
  }
}
