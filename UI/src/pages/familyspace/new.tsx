import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material'
import { FamilyRestroom as FamilyIcon } from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import { fetchWithCSRF } from '@/lib/api-client'

export default function NewFamilyspacePage() {
  const router = useRouter()
  const { status } = useSession()
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'unauthenticated') {
    router.replace('/login')
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetchWithCSRF('/api/familyspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as any).error || 'Failed to create familyspace')
      }

      const data = await res.json()
      // Switch to the new familyspace then go to dashboard
      await fetch(`/api/familyspaces/${data.data?.id}/switch`, {
        method: 'POST',
        credentials: 'include',
      })
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Head>
        <title>Create Familyspace | Heard Again</title>
      </Head>
      <Layout>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: ProfileColors.surface,
            px: 3,
          }}
        >
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              width: '100%',
              maxWidth: 480,
              bgcolor: ProfileColors.surfaceContainerLow,
              borderRadius: '2rem',
              p: { xs: 4, md: 6 },
              boxShadow: '0 8px 40px rgba(28,28,25,0.06)',
            }}
          >
            <Box sx={{ textAlign: 'center', mb: 5 }}>
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  bgcolor: ProfileColors.secondaryContainer,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3,
                }}
              >
                <FamilyIcon sx={{ fontSize: 36, color: ProfileColors.primary }} />
              </Box>
              <Typography
                sx={{
                  fontFamily: 'var(--font-newsreader), serif',
                  fontSize: '2rem',
                  fontWeight: 700,
                  color: ProfileColors.primary,
                  lineHeight: 1.1,
                }}
              >
                Create a Familyspace
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-manrope), sans-serif',
                  fontSize: '1rem',
                  color: ProfileColors.onSurfaceVariant,
                  mt: 1.5,
                  lineHeight: 1.6,
                }}
              >
                A familyspace is a private home for your family&apos;s stories, voices, and memories.
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <TextField
              label="Familyspace name"
              placeholder="e.g. The Johnson Family"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              autoFocus
              inputProps={{ maxLength: 100 }}
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={isSubmitting || !name.trim()}
              sx={{
                backgroundColor: ProfileColors.primary,
                borderRadius: '999px',
                py: 1.5,
                fontFamily: 'var(--font-manrope), sans-serif',
                fontWeight: 700,
                fontSize: '1rem',
                textTransform: 'none',
                '&:hover': { backgroundColor: ProfileColors.primaryContainer, color: ProfileColors.surfaceContainerLowest },
              }}
            >
              {isSubmitting ? (
                <CircularProgress size={22} color="inherit" />
              ) : (
                'Create Familyspace'
              )}
            </Button>

            <Button
              variant="text"
              fullWidth
              onClick={() => router.push('/')}
              sx={{
                mt: 2,
                color: ProfileColors.onSurfaceVariant,
                fontFamily: 'var(--font-manrope), sans-serif',
                textTransform: 'none',
              }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Layout>
    </>
  )
}

export async function getServerSideProps() {
  return { props: {} }
}
