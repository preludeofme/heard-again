import Head from 'next/head'
import { useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/router'
import { Layout } from '@/components/layout/Layout'
import { ArchiveShell, isArchiveLens, type ArchiveLens } from '@/components/archive/ArchiveShell'
import { LifeJourneyLens } from '@/components/archive/lenses/LifeJourneyLens'
import { StoriesLens } from '@/components/archive/lenses/StoriesLens'
import { KeepsakesLens } from '@/components/archive/lenses/KeepsakesLens'
import { VoicesLens } from '@/components/archive/lenses/VoicesLens'

const DEFAULT_LENS: ArchiveLens = 'journey'

export default function ArchivePage() {
  const router = useRouter()

  const lens: ArchiveLens = useMemo(() => {
    const fromQuery = router.query.lens
    if (typeof fromQuery === 'string' && isArchiveLens(fromQuery)) {
      return fromQuery
    }
    return DEFAULT_LENS
  }, [router.query.lens])

  // Normalize URL — if no lens query, push the default so deep links and reloads stay in sync.
  useEffect(() => {
    if (!router.isReady) return
    if (typeof router.query.lens !== 'string' || !isArchiveLens(router.query.lens)) {
      router.replace(
        { pathname: router.pathname, query: { ...router.query, lens: DEFAULT_LENS } },
        undefined,
        { shallow: true },
      )
    }
  }, [router])

  const handleLensChange = useCallback((next: ArchiveLens) => {
    router.replace(
      { pathname: router.pathname, query: { ...router.query, lens: next } },
      undefined,
      { shallow: true },
    )
  }, [router])

  return (
    <>
      <Head>
        <title>The Living Archive | Heard Again</title>
        <meta name="description" content="A unified family archive — life journey, stories, voices, and keepsakes." />
      </Head>
      <Layout>
        <ArchiveShell lens={lens} onLensChange={handleLensChange}>
          {lens === 'journey' && <LifeJourneyLens />}
          {lens === 'stories' && <StoriesLens />}
          {lens === 'keepsakes' && <KeepsakesLens />}
          {lens === 'voices' && <VoicesLens />}
        </ArchiveShell>
      </Layout>
    </>
  )
}
