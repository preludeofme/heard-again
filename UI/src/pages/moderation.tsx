import { useEffect, useState } from 'react'
import Head from 'next/head'
import {
  Box, Typography, Card, CardContent, Button, Chip, CircularProgress, Alert,
} from '@mui/material'
import { Layout } from '@/components/layout/Layout'
import { fetchWithCSRF } from '@/lib/api-client'
import { useSnackbar } from 'notistack'
import { format } from 'date-fns'

interface PendingSubmission {
  id: string
  title: string
  content: string
  submittedByName: string | null
  submittedByEmail: string | null
  createdAt: string
  subject?: { id: string; firstName: string; lastName?: string | null; displayName?: string | null } | null
}

export default function ModerationPage() {
  const { enqueueSnackbar } = useSnackbar()
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const loadPending = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/stories/pending', { credentials: 'include' })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load pending submissions')
      }
      setSubmissions(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending submissions')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPending()
  }, [])

  const handleModerate = async (storyId: string, action: 'approve' | 'reject') => {
    setActingId(storyId)
    try {
      const response = await fetchWithCSRF(`/api/stories/${storyId}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update submission')
      }
      setSubmissions((prev) => prev.filter((s) => s.id !== storyId))
      enqueueSnackbar(action === 'approve' ? 'Story approved and published' : 'Story rejected', { variant: 'success' })
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Failed to update submission', { variant: 'error' })
    } finally {
      setActingId(null)
    }
  }

  return (
    <Layout>
      <Head>
        <title>Pending Submissions — Heard Again</title>
      </Head>

      <Box sx={{ px: { xs: 3, md: 8 }, py: 6, maxWidth: 900, mx: 'auto' }}>
        <Typography variant="h4" className="serif-font" sx={{ color: '#16334a', fontWeight: 700, mb: 1 }}>
          Pending Submissions
        </Typography>
        <Typography sx={{ color: '#546669', mb: 4 }}>
          Stories submitted through a public profile link wait here until a family member approves them.
        </Typography>

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {!isLoading && error && <Alert severity="error">{error}</Alert>}

        {!isLoading && !error && submissions.length === 0 && (
          <Typography sx={{ color: '#8a9a97', fontStyle: 'italic', textAlign: 'center', py: 6 }}>
            Nothing waiting for review right now.
          </Typography>
        )}

        {!isLoading && !error && submissions.map((submission) => {
          const subjectName = submission.subject
            ? submission.subject.displayName || `${submission.subject.firstName}${submission.subject.lastName ? ` ${submission.subject.lastName}` : ''}`
            : null

          return (
            <Card key={submission.id} sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                  <Box>
                    <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600 }}>
                      {submission.title}
                    </Typography>
                    {subjectName && (
                      <Chip size="small" label={`About ${subjectName}`} sx={{ mt: 0.5, bgcolor: '#e8f0ee', color: '#16334a' }} />
                    )}
                  </Box>
                  <Typography variant="caption" sx={{ color: '#8a9a97' }}>
                    {format(new Date(submission.createdAt), 'MMM d, yyyy')}
                  </Typography>
                </Box>

                <Typography variant="body2" sx={{ color: '#546669', mt: 2, whiteSpace: 'pre-wrap' }}>
                  {submission.content.replace(/<[^>]*>/g, '')}
                </Typography>

                <Typography variant="caption" sx={{ color: '#8a9a97', display: 'block', mt: 2 }}>
                  Submitted by {submission.submittedByName} ({submission.submittedByEmail})
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Button
                    variant="contained"
                    disabled={actingId === submission.id}
                    onClick={() => handleModerate(submission.id, 'approve')}
                    sx={{ backgroundColor: '#1a6b5a', '&:hover': { backgroundColor: '#145a4b' } }}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    disabled={actingId === submission.id}
                    onClick={() => handleModerate(submission.id, 'reject')}
                  >
                    Reject
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )
        })}
      </Box>
    </Layout>
  )
}
