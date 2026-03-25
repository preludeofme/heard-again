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
        destination: '/dashboard',
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
        <title>Heard Again | Preserve the Voices That Matter Most</title>
        <meta name="description" content="A collaborative sanctuary for your family's identity. Invite loved ones to share memories and build a collective portrait of a legacy that lasts forever." />
      </Head>
      <LandingPage />
    </>
  )
}
