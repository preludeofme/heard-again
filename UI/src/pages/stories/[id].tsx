import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { useRouter } from 'next/router'
import { useEffect, useState, useCallback } from 'react'
import {
  Box, Typography, Card, Avatar, Chip, IconButton, Button,
  TextField, Divider, CircularProgress, Grid,
} from '@mui/material'
import {
  ArrowBack, PlayArrow, Pause, Favorite, FavoriteBorder,
  Edit, Schedule, VolumeUp, Send, Person, Comment as CommentIcon,
} from '@mui/icons-material'
import { formatDistanceToNow, format } from 'date-fns'

interface StoryDetail {
  id: string
  title: string
  content: string
  excerpt?: string
  storyType: string
  status: string
  isPinned: boolean
  storyDate?: string
  tags: string[]
  subject?: { id: string; firstName: string; lastName?: string; nickname?: string }
  speaker?: { id: string; firstName: string; lastName?: string; nickname?: string }
  createdBy: { id: string; displayName?: string; email: string; avatarUrl?: string }
  voiceProfile?: { id: string; name: string }
  generatedAudio?: { id: string; storagePath: string; durationSeconds?: number; mimeType?: string }
  assets: Array<{
    id: string
    role: string
    sortOrder: number
    caption?: string
    asset: { id: string; filename: string; originalName: string; mimeType: string; assetType: string }
  }>
  comments: Array<{
    id: string
    content: string
    createdAt: string
    user: { id: string; displayName?: string; avatarUrl?: string }
    replies: Array<{
      id: string
      content: string
      createdAt: string
      user: { id: string; displayName?: string; avatarUrl?: string }
    }>
  }>
  favoriteCount: number
  createdAt: string
  updatedAt: string
}

export default function StoryDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const [story, setStory] = useState<StoryDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFavorited, setIsFavorited] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  const fetchStory = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/stories/${id}`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load story')
      setStory(data.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchStory()
  }, [fetchStory])

  const handleToggleFavorite = async () => {
    if (!story) return
    try {
      const method = isFavorited ? 'DELETE' : 'POST'
      await fetch(`/api/stories/${story.id}/favorite`, { method })
      setIsFavorited(!isFavorited)
    } catch {
      // Silently fail
    }
  }

  const handleSubmitComment = async () => {
    if (!story || !commentText.trim()) return
    setIsSubmittingComment(true)
    try {
      const res = await fetch(`/api/stories/${story.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText }),
      })
      if (res.ok) {
        setCommentText('')
        fetchStory()
      }
    } catch {
      // Silently fail
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const personName = (p?: { firstName: string; lastName?: string; nickname?: string }) => {
    if (!p) return ''
    return p.nickname || `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error || !story) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
          <Typography color="error">{error || 'Story not found'}</Typography>
          <Button variant="contained" onClick={() => router.push('/stories')}>Back to Stories</Button>
        </Box>
      </Layout>
    )
  }

  return (
    <>
      <Head>
        <title>{story.title} - Heard Again</title>
        <meta name="description" content={story.excerpt || story.title} />
      </Head>
      <Layout>
        <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4' }}>
          {/* Header Bar */}
          <Box sx={{ px: { xs: 3, md: 8 }, py: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => router.push('/stories')} sx={{ color: '#16334a' }}>
              <ArrowBack />
            </IconButton>
            <Box sx={{ flexGrow: 1 }} />
            <Chip
              label={story.status}
              size="small"
              sx={{
                backgroundColor: story.status === 'PUBLISHED' ? '#e8f5e9' : story.status === 'DRAFT' ? '#fff3e0' : '#fce4ec',
                color: story.status === 'PUBLISHED' ? '#2e7d32' : story.status === 'DRAFT' ? '#e65100' : '#c62828',
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            />
            <IconButton onClick={handleToggleFavorite} sx={{ color: isFavorited ? '#e53935' : '#546669' }}>
              {isFavorited ? <Favorite /> : <FavoriteBorder />}
            </IconButton>
            <IconButton onClick={() => router.push(`/stories/${story.id}/edit`)} sx={{ color: '#546669' }}>
              <Edit />
            </IconButton>
          </Box>

          {/* Main Content */}
          <Box sx={{ maxWidth: 800, mx: 'auto', px: { xs: 3, md: 4 }, pb: 8 }}>
            {/* Title */}
            <Typography
              variant="h2"
              className="serif-font"
              sx={{
                color: '#16334a',
                fontWeight: 600,
                fontStyle: 'italic',
                lineHeight: 1.2,
                mb: 3,
                fontSize: { xs: '2rem', md: '3rem' },
              }}
            >
              {story.title}
            </Typography>

            {/* Meta Row */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar
                  src={story.createdBy.avatarUrl || ''}
                  sx={{ width: 32, height: 32 }}
                />
                <Typography variant="body2" sx={{ color: '#546669', fontWeight: 500 }}>
                  {story.createdBy.displayName || story.createdBy.email}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Schedule sx={{ fontSize: 16, color: '#546669' }} />
                <Typography variant="caption" sx={{ color: '#546669' }}>
                  {formatDistanceToNow(new Date(story.createdAt), { addSuffix: true })}
                </Typography>
              </Box>
              {story.subject && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Person sx={{ fontSize: 16, color: '#546669' }} />
                  <Typography variant="caption" sx={{ color: '#546669' }}>
                    About {personName(story.subject)}
                  </Typography>
                </Box>
              )}
              {story.favoriteCount > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Favorite sx={{ fontSize: 14, color: '#e53935' }} />
                  <Typography variant="caption" sx={{ color: '#546669' }}>
                    {story.favoriteCount}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Story Date */}
            {story.storyDate && (
              <Card sx={{ backgroundColor: '#f6f3ee', p: 2, borderRadius: 3, mb: 4, display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                <Schedule sx={{ fontSize: 18, color: '#16334a' }} />
                <Typography variant="body2" sx={{ color: '#16334a', fontWeight: 500 }}>
                  {format(new Date(story.storyDate), 'MMMM d, yyyy')}
                </Typography>
              </Card>
            )}

            {/* Tags */}
            {story.tags.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 4 }}>
                {story.tags.map((tag) => (
                  <Chip key={tag} label={tag} size="small" sx={{ backgroundColor: '#d0e3e6', color: '#16334a' }} />
                ))}
              </Box>
            )}

            {/* Generated Audio Player */}
            {story.generatedAudio && (
              <Card sx={{ backgroundColor: '#2e4a62', p: 3, borderRadius: 4, mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <IconButton
                    onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                    sx={{ backgroundColor: 'white', color: '#16334a', '&:hover': { backgroundColor: '#f0f0f0' } }}
                  >
                    {isPlayingAudio ? <Pause /> : <PlayArrow />}
                  </IconButton>
                  <Box sx={{ flexGrow: 1 }}>
                    <Box sx={{ height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 1, overflow: 'hidden' }}>
                      <Box sx={{ width: isPlayingAudio ? '45%' : '0%', height: '100%', backgroundColor: 'white', transition: 'width 0.3s' }} />
                    </Box>
                  </Box>
                  {story.generatedAudio.durationSeconds && (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
                      {Math.floor(story.generatedAudio.durationSeconds / 60)}:{String(Math.floor(story.generatedAudio.durationSeconds % 60)).padStart(2, '0')}
                    </Typography>
                  )}
                  {story.voiceProfile && (
                    <Chip
                      icon={<VolumeUp sx={{ fontSize: 14, color: '#2e4a62 !important' }} />}
                      label={story.voiceProfile.name}
                      size="small"
                      sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                    />
                  )}
                </Box>
              </Card>
            )}

            {/* Story Content */}
            <Typography
              variant="body1"
              sx={{
                color: '#333',
                lineHeight: 1.9,
                fontSize: '1.15rem',
                whiteSpace: 'pre-wrap',
                mb: 6,
              }}
            >
              {story.content}
            </Typography>

            {/* Attached Assets */}
            {story.assets.length > 0 && (
              <Box sx={{ mb: 6 }}>
                <Typography variant="h6" sx={{ color: '#16334a', mb: 2, fontWeight: 600 }}>
                  Attachments
                </Typography>
                <Grid container spacing={2}>
                  {story.assets.map((sa) => (
                    <Grid key={sa.id} size={{ xs: 6, sm: 4 }}>
                      <Card
                        sx={{
                          p: 2,
                          borderRadius: 3,
                          cursor: 'pointer',
                          transition: 'transform 0.2s',
                          '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 },
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#16334a' }} noWrap>
                          {sa.asset.originalName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#546669' }}>
                          {sa.asset.assetType}
                        </Typography>
                        {sa.caption && (
                          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#888', fontStyle: 'italic' }}>
                            {sa.caption}
                          </Typography>
                        )}
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            <Divider sx={{ my: 4 }} />

            {/* Comments Section */}
            <Box>
              <Typography variant="h6" sx={{ color: '#16334a', mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CommentIcon sx={{ fontSize: 20 }} />
                Comments ({story.comments.length})
              </Typography>

              {/* New Comment Input */}
              <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
                <TextField
                  fullWidth
                  placeholder="Share a thought about this memory..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  multiline
                  maxRows={4}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#ffffff',
                      borderRadius: 3,
                    },
                  }}
                />
                <IconButton
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim() || isSubmittingComment}
                  sx={{
                    backgroundColor: '#16334a',
                    color: 'white',
                    alignSelf: 'flex-end',
                    '&:hover': { backgroundColor: '#2e4a62' },
                    '&.Mui-disabled': { backgroundColor: '#ccc' },
                  }}
                >
                  {isSubmittingComment ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <Send />}
                </IconButton>
              </Box>

              {/* Comment List */}
              {story.comments.map((comment) => (
                <Box key={comment.id} sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Avatar src={comment.user.avatarUrl || ''} sx={{ width: 36, height: 36 }} />
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#16334a' }}>
                          {comment.user.displayName || 'Anonymous'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#999' }}>
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: '#444', lineHeight: 1.6 }}>
                        {comment.content}
                      </Typography>

                      {/* Replies */}
                      {comment.replies.length > 0 && (
                        <Box sx={{ ml: 3, mt: 2, pl: 2, borderLeft: '2px solid #e0e0e0' }}>
                          {comment.replies.map((reply) => (
                            <Box key={reply.id} sx={{ mb: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                                <Typography variant="caption" sx={{ fontWeight: 600, color: '#16334a' }}>
                                  {reply.user.displayName || 'Anonymous'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#999' }}>
                                  {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                                </Typography>
                              </Box>
                              <Typography variant="body2" sx={{ color: '#555' }}>
                                {reply.content}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Box>
              ))}

              {story.comments.length === 0 && (
                <Typography variant="body2" sx={{ color: '#999', fontStyle: 'italic', textAlign: 'center', py: 4 }}>
                  No comments yet. Be the first to share a thought.
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Layout>
    </>
  )
}
