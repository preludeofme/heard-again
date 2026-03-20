import Head from 'next/head'
import { Layout } from '@/components/Layout'
import { DocumentsPage } from '@/components/DocumentsPage'
import { mockDocuments } from '@/data/mockData'

export default function Documents() {
  return (
    <>
      <Head>
        <title>Documents - Heard Again</title>
        <meta name="description" content="Document Archive" />
      </Head>
      <Layout>
        <DocumentsPage documents={mockDocuments} />
      </Layout>
    </>
  )
}
