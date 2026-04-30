import { useEffect } from 'react'
import { useRouter } from 'next/router'

/**
 * Legacy Collections Page
 * Redirects to the unified Archive Shell with the 'stories' lens active.
 */
export default function CollectionsRedirect() {
  const router = useRouter()

  useEffect(() => {
    if (router.isReady) {
      router.replace({
        pathname: '/archive',
        query: { ...router.query, lens: 'stories' },
      })
    }
  }, [router.isReady, router.query])

  return null
}
