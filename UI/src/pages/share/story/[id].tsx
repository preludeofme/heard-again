import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Box, Typography, Container, CircularProgress, Chip } from '@mui/material'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { format } from 'date-fns'

interface PublicStory {
  id: string
  title: string
  content: string
  excerpt?: string | null
  storyDate?: string | null
  tags: string[]
  subject?: { id: string; firstName: string; lastName?: string | null; displayName?: string | null } | null
  createdAt: string
}

export default function PublicStoryPage() {
  const router = useRouter()
  const { id, token } = router.query

  const [story, setStory] = useState<PublicStory | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !router.isReady) return

    const fetchStory = async () => {
      try {
        const url = `/api/stories/${id}${token ? `?token=${encodeURIComponent(token as string)}` : ''}`
        const response = await fetch(url)
        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'This story link is invalid or has expired.')
        }
        setStory(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'This story link is invalid or has expired.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchStory()
  }, [id, token, router.isReady])

  const subjectName = story?.subject
    ? story.subject.displayName || `${story.subject.firstName}${story.subject.lastName ? ` ${story.subject.lastName}` : ''}`
    : null

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#fcf9f4' }}>
      <Head>
        <title>{story ? `${story.title} — Heard Again` : 'Shared Story — Heard Again'}</title>
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
                Story not available
              </Typography>
              <Typography sx={{ color: '#546669' }}>{error}</Typography>
            </Box>
          )}

          {!isLoading && !error && story && (
            <Box>
              {subjectName && (
                <Chip label={`A memory of ${subjectName}`} sx={{ mb: 2, bgcolor: '#e8f0ee', color: '#16334a' }} />
              )}
              <Typography variant="h3" className="serif-font" sx={{ color: '#16334a', fontWeight: 700, mb: 1 }}>
                {story.title}
              </Typography>
              {story.storyDate && (
                <Typography variant="body2" sx={{ color: '#8a9a97', mb: 4 }}>
                  {format(new Date(story.storyDate), 'MMMM d, yyyy')}
                </Typography>
              )}
              <Box
                sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '1.15rem', lineHeight: 1.8, color: '#2d3b3a' }}
                dangerouslySetInnerHTML={{ __html: story.content }}
              />
            </Box>
          )}
        </Container>
      </Box>
    </Box>
  )
}
