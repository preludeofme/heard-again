import { useEffect } from 'react'
import { useRouter } from 'next/router'

/**
 * Legacy Timeline Page
 * Redirects to the unified Archive Shell with the 'journey' lens active.
 */
export default function TimelineRedirect() {
  const router = useRouter()

  useEffect(() => {
    if (router.isReady) {
      router.replace({
        pathname: '/archive',
        query: { ...router.query, lens: 'journey' },
      })
    }
  }, [router.isReady, router.query])

  return null
}
