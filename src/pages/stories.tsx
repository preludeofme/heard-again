import Head from 'next/head'
import { Layout } from '@/components/Layout'
import { StoriesPage } from '@/components/StoriesPage'
import { mockStories } from '@/data/mockData'

export default function Stories() {
  return (
    <>
      <Head>
        <title>Stories - Heard Again</title>
        <meta name="description" content="Help us tell their story" />
      </Head>
      <Layout>
        <StoriesPage stories={mockStories} />
      </Layout>
    </>
  )
}
