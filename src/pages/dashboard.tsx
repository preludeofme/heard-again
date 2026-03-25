import Head from 'next/head'
import { Dashboard } from '@/components/pages/Dashboard'
import { useDashboardController } from '@/controllers/useDashboardController'
import { Layout } from '@/components/layout/Layout'
import { Box, CircularProgress, Typography, Button } from '@mui/material'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const controller = useDashboardController()
  const [onboardingChecked, setOnboardingChecked] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
      return
    }

    if (status === 'authenticated' && !onboardingChecked) {
      fetch('/api/auth/onboarding-status')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && !data.data.onboardingComplete) {
            router.replace('/onboarding')
          } else {
            setOnboardingChecked(true)
          }
        })
        .catch(() => {
          setOnboardingChecked(true)
        })
    }
  }, [status, router, onboardingChecked])

  if (status === 'loading' || !onboardingChecked || controller.isLoading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  if (controller.hasError) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 2 }}>
          <Typography color="error">{controller.errorMessage || 'Failed to load dashboard'}</Typography>
          <Button variant="contained" onClick={controller.refreshMemoryWall}>Retry</Button>
        </Box>
      </Layout>
    )
  }

  // Build a legacy subject from the first family member or session data
  const firstMember = controller.familyMembers[0]
  const legacySubject = {
    id: firstMember?.id || 'default',
    fullName: firstMember?.name || session?.user?.name || 'Your Family',
    lifespanText: firstMember?.isDeceased ? 'In Loving Memory' : 'Living Legacy',
    bio: `${controller.stats.stories} stories preserved, ${controller.stats.people} family members`,
    avatarUrl: '',
    accentIcon: 'heart',
  }

  return (
    <>
      <Head>
        <title>Dashboard | Heard Again</title>
      </Head>
      <Layout>
        <Dashboard legacySubject={legacySubject} memoryWallItems={controller.memoryWall} />
      </Layout>
    </>
  )
}
