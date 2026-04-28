import { useState, useCallback, useEffect } from 'react'
import { getCSRFToken } from '@/lib/api-client'

/**
 * Hook to manage CSRF tokens for state-changing requests.
 * Uses the global getCSRFToken utility to ensure consistency across components.
 */
export function useCSRF() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchToken = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const token = await getCSRFToken()
      setCsrfToken(token)
      setIsLoading(false)
      return token
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown CSRF error')
      setError(error)
      setIsLoading(false)
      throw error
    }
  }, [])

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
