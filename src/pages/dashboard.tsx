import Head from 'next/head'
import { Dashboard } from '@/components/Dashboard'
import { useDashboardController } from '@/controllers/useDashboardController'
import { Box, CircularProgress, Typography, Button } from '@mui/material'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const controller = useDashboardController()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [status, router])

  if (status === 'loading' || controller.isLoading) {
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
