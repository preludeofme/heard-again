import Head from 'next/head'
import { Layout } from '@/components/Layout'
import { TalkPage } from '@/components/TalkPage'
import { mockMessages, mockLegacySubject } from '@/data/mockData'

export default function Talk() {
  return (
    <>
      <Head>
        <title>Talk - Heard Again</title>
        <meta name="description" content="Conversation with Evelyn" />
      </Head>
      <Layout>
        <TalkPage 
          messages={mockMessages}
          legacySubject={mockLegacySubject}
        />
      </Layout>
    </>
  )
}
