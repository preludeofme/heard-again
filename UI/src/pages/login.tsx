import Head from 'next/head'
import { LoginPage } from '@/components/pages/LoginPage'

export default function Login() {
  return (
    <>
      <Head>
        <title>Log In | Heard Again</title>
        <meta name="description" content="Log in to your Heard Again account to access your family's preserved stories, voices, and memories." />
        <meta property="og:title" content="Log In | Heard Again" />
        <meta property="og:description" content="Log in to your Heard Again account to access your family's preserved stories, voices, and memories." />
        <meta property="og:image" content="https://heardagain.com/og-image.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Log In | Heard Again" />
        <meta name="twitter:description" content="Log in to your Heard Again account to access your family's preserved stories, voices, and memories." />
        <meta name="twitter:image" content="https://heardagain.com/og-image.png" />
        <link rel="canonical" href="https://heardagain.com/login" />
      </Head>
      <LoginPage />
    </>
  )
}


export async function getServerSideProps() { return { props: {} } }
