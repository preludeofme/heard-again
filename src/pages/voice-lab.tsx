import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { VoiceLabPage } from '@/components/pages/VoiceLabPage'

export default function VoiceLab() {
  return (
    <>
      <Head>
        <title>Voice Lab - Heard Again</title>
        <meta name="description" content="Voice & Documents Lab" />
      </Head>
      <Layout>
        <VoiceLabPage />
      </Layout>
    </>
  )
}
