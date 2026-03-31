import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import {
  Box, Typography, Card, Grid, Button, IconButton, Chip,
  CircularProgress, Divider, Avatar, Tooltip,
} from '@mui/material'
import {
  Favorite, FavoriteBorder, AutoStories, Schedule, Person,
  ArrowForward, Delete, PlayArrow,
} from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'

interface FavoritedStory {
  id: string
  title: string
  excerpt?: string
  storyType: string
  status: string
  isPinned: boolean
  tags: string[]
  subject?: { id: string; firstName: string; lastName?: string }
  speaker?: { id: string; firstName: string; lastName?: string }
  createdBy?: { id: string; displayName?: string; email: string }
  hasAudio: boolean
  counts: {
    comments: number
    assets: number
    favorites: number
  }
  favoritedAt: string
  createdAt: string
}

export default function FavoritesPage() {
  const router = useRouter()
  const [stories, setStories] = useState<FavoritedStory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [unfavoritingId, setUnfavoritingId] = useState<string | null>(null)

  const fetchFavorites = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/favorites', { credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setStories(data.data.stories)
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  const handleUnfavorite = async (storyId: string) => {
    setUnfavoritingId(storyId)
    try {
      await fetch(`/api/stories/${storyId}/favorite`, { method: 'DELETE', credentials: 'include' })
      setStories(prev => prev.filter(s => s.id !== storyId))
    } catch {
      // Silently fail
    } finally {
      setUnfavoritingId(null)
    }
  }

  const personName = (p?: { firstName: string; lastName?: string }) =>
    p ? `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}` : ''

  if (isLoading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  return (
    <>
      <Head>
        <title>My Favorites - Heard Again</title>
        <meta name="description" content="Your favorite stories and memories" />
      </Head>
      <Layout>
        <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4', px: { xs: 3, md: 8 }, py: 6 }}>
          {/* Header */}
          <Box sx={{ maxWidth: 1200, mx: 'auto', mb: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Favorite sx={{ color: '#e53935', fontSize: 32 }} />
              <Typography
                variant="h3"
                className="serif-font"
                sx={{ color: '#16334a', fontStyle: 'italic' }}
              >
                My Favorites
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ color: '#546669' }}>
              {stories.length} {stories.length === 1 ? 'story' : 'stories'} saved to your favorites
            </Typography>
          </Box>

          <Divider sx={{ mb: 6 }} />

          {/* Favorites Grid */}
          <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
            {stories.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 12 }}>
                <FavoriteBorder sx={{ fontSize: 64, color: '#d0e3e6', mb: 2 }} />
                <Typography variant="h6" sx={{ color: '#546669', mb: 1 }}>
                  No favorites yet
                </Typography>
                <Typography variant="body2" sx={{ color: '#999', mb: 3 }}>
                  Click the heart icon on any story to save it here.
                </Typography>
                <Button
                  variant="contained"
                  endIcon={<ArrowForward />}
                  onClick={() => router.push('/stories')}
                  sx={{ borderRadius: 2 }}
                >
                  Browse Stories
                </Button>
              </Box>
            ) : (
              <Grid container spacing={3}>
                {stories.map((story) => (
                  <Grid key={story.id} size={{ xs: 12, md: 6, lg: 4 }}>
                    <Card
                      sx={{
                        p: 4,
                        borderRadius: 4,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
                        },
                      }}
                      onClick={() => router.push(`/stories/${story.id}`)}
                    >
                      {/* Header with type and unfavorite */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Chip
                          label={story.storyType}
                          size="small"
                          sx={{
                            backgroundColor: '#f6f3ee',
                            color: '#546669',
                            fontSize: '0.7rem',
                          }}
                        />
                        <Tooltip title="Remove from favorites">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUnfavorite(story.id)
                            }}
                            disabled={unfavoritingId === story.id}
                            sx={{
                              color: '#e53935',
                              '&:hover': { backgroundColor: 'rgba(229, 57, 53, 0.1)' },
                            }}
                          >
                            {unfavoritingId === story.id ? (
                              <CircularProgress size={20} color="inherit" />
                            ) : (
                              <Favorite fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      </Box>

                      <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600, mb: 1 }}>
                        {story.title}
                      </Typography>

                      {story.excerpt && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: '#666',
                            mb: 2,
                            flexGrow: 1,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {story.excerpt}
                        </Typography>
                      )}

                      {/* Meta */}
                      <Box sx={{ mt: 'auto', pt: 2 }}>
                        {/* Author */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Avatar
                            sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: '#d0e3e6' }}
                          >
                            {(story.createdBy?.displayName || story.createdBy?.email || '?')[0].toUpperCase()}
                          </Avatar>
                          <Typography variant="caption" sx={{ color: '#666' }}>
                            {story.createdBy?.displayName || story.createdBy?.email?.split('@')[0] || 'Unknown'}
                          </Typography>
                        </Box>

                        {/* Subject & Stats */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            {story.subject && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Person sx={{ fontSize: 14, color: '#546669' }} />
                                <Typography variant="caption" sx={{ color: '#546669' }}>
                                  {personName(story.subject)}
                                </Typography>
                              </Box>
                            )}
                            {story.hasAudio && (
                              <Chip
                                icon={<PlayArrow sx={{ fontSize: 14 }} />}
                                label="Audio"
                                size="small"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>
                          <Typography variant="caption" sx={{ color: '#999' }}>
                            {formatDistanceToNow(new Date(story.favoritedAt), { addSuffix: true })}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Tags */}
                      {story.tags.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 2 }}>
                          {story.tags.slice(0, 3).map((tag) => (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              sx={{ height: 20, fontSize: '0.7rem', backgroundColor: '#f6f3ee' }}
                            />
                          ))}
                          {story.tags.length > 3 && (
                            <Chip
                              label={`+${story.tags.length - 3}`}
                              size="small"
                              sx={{ height: 20, fontSize: '0.7rem', backgroundColor: '#f6f3ee' }}
                            />
                          )}
                        </Box>
                      )}
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </Box>
      </Layout>
    </>
  )
}
