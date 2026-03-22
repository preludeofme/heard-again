import Head from 'next/head'
import { FamilyTreePage } from '@/components/FamilyTreePage'

export default function FamilyTree() {
  return (
    <>
      <Head>
        <title>Family Tree | Heard Again</title>
        <meta name="description" content="Chart your family legacy across generations. The Emerson Legacy - four generations of storytelling." />
      </Head>
      <FamilyTreePage />
    </>
  )
}
