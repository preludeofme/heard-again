import { useEffect } from 'react'
import { useRouter } from 'next/router'

/**
 * Legacy Documents Page
 * Redirects to the unified Archive Shell with the 'keepsakes' lens active.
 */
export default function DocumentsRedirect() {
  const router = useRouter()

  useEffect(() => {
    if (router.isReady) {
      router.replace({
        pathname: '/archive',
        query: { ...router.query, lens: 'keepsakes' },
      })
    }
  }, [router.isReady, router.query])

  return null
}
