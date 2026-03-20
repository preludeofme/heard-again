import Head from 'next/head'
import { Layout } from '@/components/Layout'
import { VoiceLabPage } from '@/components/VoiceLabPage'
import { mockAudioSamples, mockVoiceCloneStatus, mockDocuments } from '@/data/mockData'

export default function VoiceLab() {
  return (
    <>
      <Head>
        <title>Voice Lab - Heard Again</title>
        <meta name="description" content="Voice & Documents Lab" />
      </Head>
      <Layout>
        <VoiceLabPage 
          audioSamples={mockAudioSamples}
          voiceCloneStatus={mockVoiceCloneStatus}
          documents={mockDocuments}
        />
      </Layout>
    </>
  )
}
