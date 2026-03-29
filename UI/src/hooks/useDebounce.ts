import { useState, useCallback } from 'react'

interface UseDebounceReturn<T> {
  value: T
  debouncedValue: T
  setValue: (value: T) => void
}

export function useDebounce<T>(initialValue: T, delay: number = 300): UseDebounceReturn<T> {
  const [value, setValue] = useState<T>(initialValue)
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue)

  const setDebounced = useCallback((newValue: T) => {
    setValue(newValue)
    
    const timer = setTimeout(() => {
      setDebouncedValue(newValue)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  return { value, debouncedValue, setValue: setDebounced }
}
