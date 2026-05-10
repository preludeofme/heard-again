import Head from 'next/head'
import { useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/router'
import { Layout } from '@/components/layout/Layout'
import { MemoriesShell, isMemoriesLens, type MemoriesLens } from '@/components/legacy/MemoriesShell'
import { LifeJourneyLens } from '@/components/legacy/lenses/LifeJourneyLens'
import { StoriesLens } from '@/components/legacy/lenses/StoriesLens'
import { KeepsakesLens } from '@/components/legacy/lenses/KeepsakesLens'
import { VoicesLens } from '@/components/legacy/lenses/VoicesLens'

const DEFAULT_LENS: MemoriesLens = 'journey'

export default function MemoriesPage() {
  const router = useRouter()

  const lens: MemoriesLens = useMemo(() => {
    const fromQuery = router.query.lens
    if (typeof fromQuery === 'string' && isMemoriesLens(fromQuery)) {
      return fromQuery
    }
    return DEFAULT_LENS
  }, [router.query.lens])

  // Normalize URL — if no lens query, push the default so deep links and reloads stay in sync.
  useEffect(() => {
    if (!router.isReady) return
    if (typeof router.query.lens !== 'string' || !isMemoriesLens(router.query.lens)) {
      router.replace(
        { pathname: router.pathname, query: { ...router.query, lens: DEFAULT_LENS } },
        undefined,
        { shallow: true },
      )
    }
  }, [router])

  const handleLensChange = useCallback((next: MemoriesLens) => {
    router.replace(
      { pathname: router.pathname, query: { ...router.query, lens: next } },
      undefined,
      { shallow: true },
    )
  }, [router])

  return (
    <>
      <Head>
        <title>The Living Memories | Heard Again</title>
        <meta name="description" content="A unified family memories — life journey, stories, voices, and keepsakes." />
      </Head>
      <Layout>
        <MemoriesShell lens={lens} onLensChange={handleLensChange}>
          {lens === 'journey' && <LifeJourneyLens />}
          {lens === 'stories' && <StoriesLens />}
          {lens === 'keepsakes' && <KeepsakesLens />}
          {lens === 'voices' && <VoicesLens />}
        </MemoriesShell>
      </Layout>
    </>
  )
}
