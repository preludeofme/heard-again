import Head from 'next/head'
import { CreateAccountPage } from '@/components/pages/CreateAccountPage'

export default function SignUp() {
  return (
    <>
      <Head>
        <title>Create Your Account | Heard Again</title>
        <meta name="description" content="Begin your Digital Heirloom. Create an account to preserve your stories, wisdom, and essence for generations to come." />
      </Head>
      <CreateAccountPage />
    </>
  )
}
