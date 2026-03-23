import Head from 'next/head'
import { Dashboard } from '@/components/Dashboard'
import { useDashboardController } from '@/controllers/useDashboardController'
import { Box, CircularProgress, Typography, Button } from '@mui/material'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const controller = useDashboardController()
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
      return
    }

    // Check onboarding status for authenticated users
    if (status === 'authenticated') {
      checkOnboardingStatus()
    }
  }, [status, router])

  const checkOnboardingStatus = async () => {
    try {
      const response = await fetch('/api/auth/onboarding-status')
      const data = await response.json()

      if (!data.onboardingComplete) {
        // Redirect to onboarding if not complete
        router.replace('/onboarding')
        return
      }
    } catch (error) {
      console.error('Failed to check onboarding status:', error)
    } finally {
      setIsCheckingOnboarding(false)
    }
  }

  if (status === 'loading' || isCheckingOnboarding || controller.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (controller.hasError) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 2 }}>
        <Typography color="error">{controller.errorMessage || 'Failed to load dashboard'}</Typography>
        <Button variant="contained" onClick={controller.refreshMemoryWall}>Retry</Button>
      </Box>
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
      <Dashboard legacySubject={legacySubject} memoryWallItems={controller.memoryWall} />
    </>
  )
}
