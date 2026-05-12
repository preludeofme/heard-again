import { useEffect } from 'react'
import { useRouter } from 'next/router'

/**
 * Legacy Stories Index Page
 * Redirects to the unified Memories Shell with the 'stories' lens active.
 */
export default function StoriesRedirect() {
  const router = useRouter()

  useEffect(() => {
    if (router.isReady) {
      router.replace({
        pathname: '/legacy',
        query: { ...router.query, lens: 'stories' },
      })
    }
  }, [router.isReady, router.query])

  return null
}


export async function getServerSideProps() { return { props: {} } }
