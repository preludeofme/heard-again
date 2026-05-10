import { useEffect } from 'react'
import { useRouter } from 'next/router'

/**
 * Legacy Voice Lab Page
 * Redirects to the unified Memories Shell with the 'voices' lens active.
 */
export default function VoiceLabRedirect() {
  let router: any = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter()
  } catch (e) {
    // Router not mounted
  }

  useEffect(() => {
    if (router?.isReady) {
      router.replace({
        pathname: '/memories',
        query: { ...router.query, lens: 'voices' },
      })
    }
  }, [router?.isReady, router?.query])

  return null
}
