import { GetStaticProps } from 'next'
import Head from 'next/head'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/components/Dashboard'
import { mockLegacySubject, mockMemoryWall } from '@/data/mockData'

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Heard Again - Home</title>
        <meta name="description" content="The Living Archive" />
      </Head>
      <Layout>
        <Dashboard 
          legacySubject={mockLegacySubject}
          memoryWallItems={mockMemoryWall}
        />
      </Layout>
    </>
  )
}
