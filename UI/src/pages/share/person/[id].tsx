import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import {
  Box, Typography, Container, CircularProgress, Card, CardContent,
  TextField, Button, Alert, Divider,
} from '@mui/material'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { TurnstileWidget } from '@/components/share/TurnstileWidget'
import { format } from 'date-fns'

interface PublicStorySummary {
  id: string
  title: string
  excerpt?: string | null
  storyDate?: string | null
  createdAt: string
}

interface PublicProfile {
  id: string
  firstName: string
  lastName?: string | null
  displayName?: string | null
  bio?: string | null
  stories: PublicStorySummary[]
}

export default function PublicPersonProfilePage() {
  const router = useRouter()
  const { id, token } = router.query

  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitterName, setSubmitterName] = useState('')
  const [submitterEmail, setSubmitterEmail] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!id || !router.isReady) return

    const fetchProfile = async () => {
      try {
        const url = `/api/people/${id}/public${token ? `?token=${encodeURIComponent(token as string)}` : ''}`
        const response = await fetch(url)
        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'This profile link is invalid or has expired.')
        }
        setProfile(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'This profile link is invalid or has expired.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [id, token, router.isReady])

  const displayName = profile
    ? profile.displayName || `${profile.firstName}${profile.lastName ? ` ${profile.lastName}` : ''}`
    : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const url = `/api/people/${id}/public-stories${token ? `?token=${encodeURIComponent(token as string)}` : ''}`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          submitterName,
          submitterEmail,
          turnstileToken,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit your story')
      }
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit your story')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#fcf9f4' }}>
      <Head>
        <title>{profile ? `${displayName} — Heard Again` : 'Shared Profile — Heard Again'}</title>
      </Head>

      <PublicHeader />

      <Box component="main" sx={{ py: { xs: 6, md: 10 }, flexGrow: 1 }}>
        <Container maxWidth="md">
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
              <CircularProgress />
            </Box>
          )}

          {!isLoading && error && (
            <Box sx={{ textAlign: 'center', py: 10 }}>
              <Typography variant="h5" sx={{ color: '#16334a', mb: 2 }}>
                Profile not available
              </Typography>
              <Typography sx={{ color: '#546669' }}>{error}</Typography>
            </Box>
          )}

          {!isLoading && !error && profile && (
            <Box>
              <Typography variant="h3" className="serif-font" sx={{ color: '#16334a', fontWeight: 700, mb: 1 }}>
                {displayName}
              </Typography>
              {profile.bio && (
                <Typography sx={{ color: '#546669', mb: 4, fontFamily: 'var(--font-newsreader), serif', fontSize: '1.1rem' }}>
                  {profile.bio}
                </Typography>
              )}

              {profile.stories.length > 0 && (
                <Box sx={{ mb: 6 }}>
                  <Typography variant="h6" sx={{ color: '#16334a', mb: 2 }}>Shared memories</Typography>
                  {profile.stories.map((story) => (
                    <Card key={story.id} sx={{ mb: 2 }}>
                      <CardContent>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#16334a' }}>
                          {story.title}
                        </Typography>
                        {story.storyDate && (
                          <Typography variant="caption" sx={{ color: '#8a9a97' }}>
                            {format(new Date(story.storyDate), 'MMMM d, yyyy')}
                          </Typography>
                        )}
                        {story.excerpt && (
                          <Typography variant="body2" sx={{ mt: 1, color: '#546669' }}>
                            {story.excerpt}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}

              <Divider sx={{ mb: 4 }} />

              <Typography variant="h6" sx={{ color: '#16334a', mb: 1 }}>
                Share a memory of {displayName}
              </Typography>
              <Typography variant="body2" sx={{ color: '#546669', mb: 3 }}>
                Your story will be reviewed by the family before it appears here.
              </Typography>

              {submitted ? (
                <Alert severity="success">
                  Thank you — your story has been submitted for review.
                </Alert>
              ) : (
                <Box component="form" onSubmit={handleSubmit}>
                  {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
                  <TextField
                    fullWidth
                    required
                    label="Your name"
                    value={submitterName}
                    onChange={(e) => setSubmitterName(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    required
                    type="email"
                    label="Your email"
                    value={submitterEmail}
                    onChange={(e) => setSubmitterEmail(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    required
                    label="Story title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    required
                    multiline
                    minRows={6}
                    label="Your story"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <Box sx={{ mb: 2 }}>
                    <TurnstileWidget onToken={setTurnstileToken} />
                  </Box>
                  <Button type="submit" variant="contained" disabled={isSubmitting} sx={{ backgroundColor: '#16334a' }}>
                    {isSubmitting ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Submit story'}
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Container>
      </Box>
    </Box>
  )
}
