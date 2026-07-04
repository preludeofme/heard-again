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
        <meta property="og:image" content="https://heardagain.com/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Heard Again — Preserve Family Voices, Stories &amp; Memories" />
        <meta property="og:url" content="https://heardagain.com" />
        <meta property="og:site_name" content="Heard Again" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Heard Again — Preserve Family Voices &amp; Stories" />
        <meta name="twitter:description" content="Open-source family legacy preservation. Record, transcribe, and narrate family history with AI voice synthesis." />
        <meta name="twitter:image" content="https://heardagain.com/og-image.png" />
        <meta name="twitter:image:alt" content="Heard Again — Preserve Family Voices, Stories &amp; Memories" />
        <link rel="canonical" href="https://heardagain.com" />
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  '@id': 'https://heardagain.com/#organization',
                  name: 'Heard Again',
                  url: 'https://heardagain.com',
                  description: 'Preserve and share the voices and stories of the people you love. An open-source family legacy preservation platform with AI voice synthesis.',
                  logo: 'https://heardagain.com/og-image.png',
                  sameAs: [
                    'https://github.com/HeardAgain',
                  ],
                  foundingDate: '2024',
                },
                {
                  '@type': 'WebApplication',
                  '@id': 'https://heardagain.com/#webapplication',
                  name: 'Heard Again',
                  url: 'https://heardagain.com/',
                  description: 'Preserve your family\'s voices, stories, and memories with AI voice synthesis. Open-source platform for recording, transcribing, and narrating family history.',
                  applicationCategory: 'Multimedia',
                  operatingSystem: 'Web',
                  browserRequirements: 'Requires JavaScript',
                  offers: {
                    '@type': 'AggregateOffer',
                    lowPrice: '0',
                    highPrice: '39.99',
                    priceCurrency: 'USD',
                    offerCount: '4',
                  },
                  author: {
                    '@type': 'Organization',
                    '@id': 'https://heardagain.com/#organization',
                  },
                },
              ],
            }),
          }}
        />
      </Head>
      <LandingPage />
    </>
  )
}
