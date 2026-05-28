import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth/next'
import { LandingPage } from '@/components/pages/LandingPage'
import { authOptions } from '@/lib/auth'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions)

  if (session) {
    return {
      redirect: {
        destination: '/legacy',
        permanent: false,
      },
    }
  }

  return {
    props: {},
  }
}

export default function Home() {
  return (
    <>
      <Head>
        <title>Heard Again — Preserve Family Voices, Stories &amp; Memories | Open Source Legacy Preservation</title>
        <meta name="description" content="Preserve your family's voices, stories, and memories before they fade. Heard Again is an open-source platform for recording, transcribing, and narrating family history with AI voice synthesis. Start preserving your legacy today — free and open source." />
        <meta name="keywords" content="family history, legacy preservation, voice preservation, family stories, genealogy, oral history, AI voice cloning, family memories, open source genealogy" />
        <meta property="og:title" content="Heard Again — Preserve Family Voices, Stories &amp; Memories" />
        <meta property="og:description" content="An open-source platform for preserving your family's voices, stories, and memories with AI voice synthesis. Your family's legacy, preserved with care." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Heard Again — Preserve Family Voices &amp; Stories" />
        <meta name="twitter:description" content="Open-source family legacy preservation. Record, transcribe, and narrate family history with AI voice synthesis." />
        <link rel="canonical" href="https://heardagain.com" />
      </Head>
      <LandingPage />
    </>
  )
}
