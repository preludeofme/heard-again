import { useState, useEffect, useCallback } from 'react'
import { fetchWithCSRF } from '@/lib/api-client'

interface UseApiOptions<T> {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  initialData?: T
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

interface UseApiReturn<T> {
  data: T | undefined
  isLoading: boolean
  error: Error | null
  execute: (overrideBody?: unknown) => Promise<void>
  refresh: () => Promise<void>
}

export function useApi<T = unknown>({
  url,
  method = 'GET',
  body,
  initialData,
  onSuccess,
  onError,
}: UseApiOptions<T>): UseApiReturn<T> {
  const [data, setData] = useState<T | undefined>(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(async (overrideBody?: unknown) => {
    setIsLoading(true)
    setError(null)

    try {
      const options: RequestInit = {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }

      if (method !== 'GET' && (overrideBody !== undefined || body !== undefined)) {
        options.body = JSON.stringify(overrideBody ?? body)
      }

      const response = await fetchWithCSRF(url, options)
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || `HTTP ${response.status}`)
      }

      setData(result.data)
      onSuccess?.(result.data)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      onError?.(error)
    } finally {
      setIsLoading(false)
    }
  }, [url, method, body, onSuccess, onError])

  const refresh = useCallback(() => execute(), [execute])

  useEffect(() => {
    if (method === 'GET' && url) {
      execute()
    }
  }, [execute, method, url])

  return { data, isLoading, error, execute, refresh }
}
