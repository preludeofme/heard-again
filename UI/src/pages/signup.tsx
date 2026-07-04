import Head from 'next/head'
import { CreateAccountPage } from '@/components/pages/CreateAccountPage'

export default function SignUp() {
  return (
    <>
      <Head>
        <title>Create Your Account | Heard Again</title>
        <meta name="description" content="Begin your Digital Heirloom. Create an account to preserve your stories, wisdom, and essence for generations to come." />
        <meta property="og:title" content="Create Your Account | Heard Again" />
        <meta property="og:description" content="Begin your Digital Heirloom. Create an account to preserve your stories, wisdom, and essence for generations to come." />
        <meta property="og:image" content="https://heardagain.com/og-image.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Create Your Account | Heard Again" />
        <meta name="twitter:description" content="Begin your Digital Heirloom. Create an account to preserve your stories, wisdom, and essence for generations to come." />
        <meta name="twitter:image" content="https://heardagain.com/og-image.png" />
        <link rel="canonical" href="https://heardagain.com/signup" />
      </Head>
      <CreateAccountPage />
    </>
  )
}


export async function getServerSideProps() { return { props: {} } }
