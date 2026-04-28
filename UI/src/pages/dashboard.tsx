import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { FamilyspaceDashboard } from '@/components/dashboard/FamilyspaceDashboard'

export default function DashboardPage() {
  return (
    <Layout>
      <Head>
        <title>Dashboard | Heard Again</title>
      </Head>
      <FamilyspaceDashboard />
    </Layout>
  )
}
