import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/components/pages/Dashboard'
import { useDashboardController } from '@/controllers/useDashboardController'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'
import { Box, CircularProgress, Typography, Alert, Button } from '@mui/material'
import { useRouter } from 'next/router'

export default function DashboardPage() {
  const router = useRouter()
  const { selectedFamilyMember } = useSelectedFamilyMember()
  const { memoryWall, isLoading, hasError, errorMessage, refreshMemoryWall } = useDashboardController()

  // Map SelectedFamilyMember to LegacySubject format expected by Dashboard component
  const legacySubject = selectedFamilyMember ? {
    id: selectedFamilyMember.id,
    fullName: `${selectedFamilyMember.firstName} ${selectedFamilyMember.lastName || ''}`.trim(),
    lifespanText: selectedFamilyMember.birthDate ? 
      `${new Date(selectedFamilyMember.birthDate).getFullYear()} — ${selectedFamilyMember.deathDate ? new Date(selectedFamilyMember.deathDate).getFullYear() : 'Present'}` : 
      'Living',
    bio: 'No biography available for this member yet. Add stories and documents to build their legacy.', // Placeholder
    avatarUrl: selectedFamilyMember.avatarUrl
  } : {
    id: 'global',
    fullName: 'Global Archive',
    lifespanText: 'All Generations',
    bio: 'The collective memory of your entire family lineage.',
    avatarUrl: null
  }

  return (
    <Layout>
      <Head>
        <title>Dashboard | Heard Again</title>
      </Head>
      
      {isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
          <CircularProgress sx={{ color: '#16334a' }} />
          <Typography variant="body2" color="text.secondary">
            Gathering family memories...
          </Typography>
        </Box>
      ) : hasError ? (
        <Box sx={{ maxWidth: 600, mx: 'auto', p: 4, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {errorMessage || 'Failed to load dashboard data'}
          </Alert>
          <Button 
            variant="contained" 
            onClick={() => refreshMemoryWall()}
            sx={{ backgroundColor: '#16334a', borderRadius: 2 }}
          >
            Try Again
          </Button>
        </Box>
      ) : (
        <Dashboard 
          legacySubject={legacySubject} 
          memoryWallItems={memoryWall} 
        />
      )}
    </Layout>
  )
}
