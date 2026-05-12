import { useEffect } from 'react'
import { useRouter } from 'next/router'

/**
 * Legacy Timeline Page
 * Redirects to the unified Memories Shell with the 'journey' lens active.
 */
export default function TimelineRedirect() {
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
        pathname: '/legacy',
        query: { ...router.query, lens: 'journey' },
      })
    }
  }, [router?.isReady, router?.query])

  return null
}


export async function getServerSideProps() { return { props: {} } }
