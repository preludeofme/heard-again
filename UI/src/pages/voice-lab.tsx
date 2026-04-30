import { useEffect } from 'react'
import { useRouter } from 'next/router'

/**
 * Legacy Voice Lab Page
 * Redirects to the unified Archive Shell with the 'voices' lens active.
 */
export default function VoiceLabRedirect() {
  const router = useRouter()

  useEffect(() => {
    if (router.isReady) {
      router.replace({
        pathname: '/archive',
        query: { ...router.query, lens: 'voices' },
      })
    }
  }, [router.isReady, router.query])

  return null
}
