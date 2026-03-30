import { useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useSessionExpiration } from '@/lib/session-handler'
import { ApiError, isApiError } from '@/lib/errors'

interface UseApiWithSessionOptions {
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
  showLoadingState?: boolean
}

interface ApiState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

export function useApiWithSession<T = any>(options: UseApiWithSessionOptions = {}) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const { handleSessionExpired } = useSessionExpiration()
  const router = useRouter()

  const execute = useCallback(
    async (apiCall: () => Promise<T>, currentPath?: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }))

      try {
        const result = await apiCall()
        setState({ data: result, loading: false, error: null })
        options.onSuccess?.(result)
        return result
      } catch (error: unknown) {
        const err = isApiError(error) ? error : new Error(String(error))
        
        // Check for session expiration
        if ((err as any).statusCode === 401 || 
            (err as any).code === 'UNAUTHORIZED' || 
            (err as any).code === 'AUTH_REQUIRED' ||
            err.message?.includes('Authentication required')) {
          handleSessionExpired(currentPath || router.asPath)
          return err
        }
        
        setState(prev => ({ ...prev, loading: false, error: err }))
        options.onError?.(err)
        throw err
      }
    },
    [handleSessionExpired, router.asPath, options]
  )

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return {
    ...state,
    execute,
    reset,
  }
}

/**
 * Hook for making API calls with automatic session handling
 * and error state management
 */
export function useApiCall<T = any>() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const { handleSessionExpired } = useSessionExpiration()
  const router = useRouter()

  const call = useCallback(
    async (apiFunction: () => Promise<T>, options?: { currentPath?: string }) => {
      setLoading(true)
      setError(null)

      try {
        const result = await apiFunction()
        setLoading(false)
        return result
      } catch (err: unknown) {
        setLoading(false)
        const error = err instanceof Error ? err : new Error(String(err))
        
        // Check for session expiration
        if (error.message.includes('Authentication required') ||
            error.message.includes('Unauthorized') ||
            (error as any).statusCode === 401) {
          handleSessionExpired(options?.currentPath || router.asPath)
          return
        }
        
        setError(error)
        throw error
      }
    },
    [handleSessionExpired, router.asPath]
  )

  return {
    call,
    loading,
    error,
    clearError: () => setError(null),
  }
}
