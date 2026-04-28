import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { WorkspaceDashboard } from '@/components/dashboard/WorkspaceDashboard'

export default function DashboardPage() {
  return (
    <Layout>
      <Head>
        <title>Dashboard | Heard Again</title>
      </Head>
      <WorkspaceDashboard />
    </Layout>
  )
}
