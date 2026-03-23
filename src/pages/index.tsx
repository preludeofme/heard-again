import Head from 'next/head'
import { LandingPage } from '@/components/pages/LandingPage'

export default function Home() {
  return (
    <>
      <Head>
        <title>Heard Again | Preserve the Voices That Matter Most</title>
        <meta name="description" content="A collaborative sanctuary for your family's identity. Invite loved ones to share memories and build a collective portrait of a legacy that lasts forever." />
      </Head>
      <LandingPage />
    </>
  )
}
