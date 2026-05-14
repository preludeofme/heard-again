import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { useRouter } from 'next/router'
import { useEffect, useState, useCallback } from 'react'
import {
  Box, Typography, Card, Avatar, Chip, IconButton, Button,
  TextField, Divider, CircularProgress, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import {
  ArrowBack, Favorite, FavoriteBorder,
  Edit, Schedule, Send, Person, Comment as CommentIcon,
  Share, ShareOutlined,
  Mic, AutoStories,
  GraphicEq,
} from '@mui/icons-material'
import { formatDistanceToNow, format } from 'date-fns'
import { NarrationPreparationBanner } from '@/components/stories/NarrationPreparationBanner'
import { NarrationReviewPanel } from '@/components/stories/NarrationReviewPanel'
import { StoryNarrationPlayer, type SavedNarration } from '@/components/stories/StoryNarrationPlayer'
import { fetchWithCSRF } from '@/lib/api-client'

type NarrationStatus = 'NONE' | 'PENDING' | 'READY' | 'APPROVED' | 'STALE' | 'FAILED'
type TranscriptionStatus = 'NONE' | 'PENDING' | 'COMPLETED' | 'FAILED'

interface VoiceProfileRow {
  id: string
  name: string
  status: string
  personId?: string | null
  person?: { id: string; firstName: string; lastName?: string | null; nickname?: string | null } | null
}

interface StoryDetail {
  id: string
  title: string
  content: string
  excerpt?: string
  storyType: string
  status: string
  isPinned: boolean
  isPublic: boolean
  authorRelationship?: string | null
  storyDate?: string
  tags: string[]
  subject?: { id: string; firstName: string; lastName?: string; nickname?: string }
  speaker?: { id: string; firstName: string; lastName?: string; nickname?: string }
  createdBy: { id: string; displayName?: string; email: string; avatarUrl?: string }
  voiceProfile?: { id: string; name: string }
  transcript?: string | null
  transcriptionStatus?: TranscriptionStatus
  narratedContent?: string | null
  narrationStatus?: NarrationStatus
  narrationModel?: string | null
  narrationRenderJobId?: string | null
  narrationUpdatedAt?: string | null
  narrationApprovedAt?: string | null
  generatedAudio?: {
    id: string
    durationSeconds?: number
    mimeType?: string
    voiceProfileId?: string | null
  } | null
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
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfileRow[]>([])
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null)
  const [isPreparingNarration, setIsPreparingNarration] = useState(false)
  const [narrationError, setNarrationError] = useState<string | null>(null)
  const [savedNarration, setSavedNarration] = useState<SavedNarration | null>(null)
  const [linkedPersonId, setLinkedPersonId] = useState<string | null | undefined>(undefined)
  const [narratorDialogOpen, setNarratorDialogOpen] = useState(false)
  const [narratorName, setNarratorName] = useState('')

  const fetchStory = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/stories/${id}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load story')
      setStory(data.data)
      const audio = data.data.generatedAudio
      // The cache-hit check on the player keys off voiceProfileId. Without it we
      // can't tell if this asset matches the currently selected voice — bail out
      // and let the player re-check via /narrate when the user lands on the page.
      if (audio?.id && audio?.voiceProfileId) {
        setSavedNarration({
          assetId: audio.id,
          downloadUrl: `/api/assets/serve/${audio.id}`,
          voiceProfileId: audio.voiceProfileId,
        })
      } else {
        setSavedNarration(null)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchStory()
  }, [fetchStory])

  useEffect(() => {
    let cancelled = false
    const loadProfiles = async () => {
      try {
        const res = await fetch('/api/voice/profiles', { credentials: 'include' })
        const payload = await res.json()
        if (!res.ok || !payload.success) return
        if (cancelled) return
        const ready = (payload.data as Array<any>).filter((p) => p.status === 'READY')
        setVoiceProfiles(
          ready.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            personId: p.person?.id ?? null,
            person: p.person ?? null,
          }))
        )
      } catch {
        // ignore — player will show empty profile state
      }
    }
    loadProfiles()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    fetch('/api/user/linked-person', { credentials: 'include' })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.success) {
          setLinkedPersonId(payload.data?.linkedPersonId ?? null)
        }
      })
      .catch(() => {
        setLinkedPersonId(null)
      })
  }, [])

  const handlePrepareNarration = useCallback(async () => {
    if (!story) return

    // If the user has no linked person, ask for their name so the model has context
    if (linkedPersonId === null) {
      setNarratorDialogOpen(true)
      return
    }

    await triggerNarrationRewrite()
  }, [story, linkedPersonId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTranscribeAudio = useCallback(async () => {
    if (!story) return
    setIsTranscribing(true)
    setTranscriptionError(null)
    try {
      const res = await fetchWithCSRF(`/api/stories/${story.id}/transcribe`, {
        method: 'POST',
        credentials: 'include',
      })
      const payload = await res.json()
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Transcription failed')
      }
      setStory((prev) =>
        prev
          ? {
              ...prev,
              transcript: payload.data.transcript,
              transcriptionStatus: payload.data.transcriptionStatus,
              content: payload.data.transcript,
            }
          : prev
      )
    } catch (err) {
      setTranscriptionError(err instanceof Error ? err.message : 'Transcription failed')
    } finally {
      setIsTranscribing(false)
    }
  }, [story])

  const triggerNarrationRewrite = useCallback(async (overrideName?: string) => {
    if (!story) return
    setIsPreparingNarration(true)
    setNarrationError(null)
    try {
      const body = overrideName ? JSON.stringify({ narratorName: overrideName }) : undefined
      const res = await fetchWithCSRF(`/api/stories/${story.id}/rewrite-first-person`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body,
      })
      const payload = await res.json()
      if (!res.ok || !payload.success) {
        if (payload.code === 'TRANSCRIPT_REQUIRED') {
          setNarrationError('Transcribe the audio first before generating a narration rewrite.')
          return
        }
        throw new Error(payload.error || 'Failed to prepare narration')
      }
      setStory((prev) =>
        prev
          ? {
              ...prev,
              narratedContent: payload.data.narratedContent,
              narrationStatus: payload.data.narrationStatus,
              narrationModel: payload.data.narrationModel,
              narrationUpdatedAt: payload.data.narrationUpdatedAt,
              narrationApprovedAt: null,
            }
          : prev
      )
    } catch (err) {
      setNarrationError(err instanceof Error ? err.message : 'Prepare failed')
    } finally {
      setIsPreparingNarration(false)
    }
  }, [story])

  const patchNarration = useCallback(
    async (action: 'update' | 'approve' | 'discard', narratedContent?: string) => {
      if (!story) return
      const body: Record<string, unknown> = { action }
      if (narratedContent !== undefined) body.narratedContent = narratedContent
      const res = await fetchWithCSRF(`/api/stories/${story.id}/narration`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const payload = await res.json()
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Narration update failed')
      }
      setStory((prev) =>
        prev
          ? {
              ...prev,
              narratedContent: payload.data.narratedContent,
              narrationStatus: payload.data.narrationStatus,
              narrationModel: payload.data.narrationModel,
              narrationUpdatedAt: payload.data.narrationUpdatedAt,
              narrationApprovedAt: payload.data.narrationApprovedAt,
            }
          : prev
      )
    },
    [story]
  )

  const handleToggleFavorite = async () => {
    if (!story) return
    try {
      const method = isFavorited ? 'DELETE' : 'POST'
      await fetchWithCSRF(`/api/stories/${story.id}/favorite`, { method, credentials: 'include' })
      setIsFavorited(!isFavorited)
    } catch {
      // Silently fail
    }
  }

  const handleSubmitComment = async () => {
    if (!story || !commentText.trim()) return
    setIsSubmittingComment(true)
    try {
      const res = await fetchWithCSRF(`/api/stories/${story.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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


  const originalAudioAsset = story?.assets.find((sa) =>
    sa.asset.mimeType?.startsWith('audio/') || sa.asset.assetType?.toLowerCase() === 'audio'
  )

  // RECORDING stories store the uploaded audio directly as generatedAudioAssetId, not in assets[].
  // When generatedAudio has no voiceProfileId it is the original recording, not an AI narration.
  const originalAudioId: string | null =
    originalAudioAsset?.asset.id ??
    (story?.storyType === 'RECORDING' && !story?.generatedAudio?.voiceProfileId
      ? (story?.generatedAudio?.id ?? null)
      : null)

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

      {/* Narrator identity dialog — shown when user has no linked person node */}
      <Dialog
        open={narratorDialogOpen}
        onClose={() => setNarratorDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ color: '#16334a', fontWeight: 600 }}>
          Who is telling this story?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#546669', mb: 2 }}>
            To rewrite this story accurately, we need to know your name so the narrator
            can refer to you correctly (e.g. "I was telling Ryan about a time…").
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Your name"
            value={narratorName}
            onChange={(e) => setNarratorName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && narratorName.trim()) {
                setNarratorDialogOpen(false)
                triggerNarrationRewrite(narratorName.trim())
              }
            }}
            placeholder="e.g. Jon Smith"
            size="small"
          />
          <Typography variant="caption" sx={{ color: '#8fa3ab', mt: 1, display: 'block' }}>
            You can permanently link your account to a person in Settings → Profile.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setNarratorDialogOpen(false)}
            sx={{ color: '#546669', textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!narratorName.trim()}
            onClick={() => {
              setNarratorDialogOpen(false)
              triggerNarrationRewrite(narratorName.trim())
            }}
            sx={{
              backgroundColor: '#16334a',
              textTransform: 'none',
              '&:hover': { backgroundColor: '#2e4a62' },
            }}
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>

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
            <IconButton
              onClick={async () => {
                try {
                  const newIsPublic = !story.isPublic
                  await fetchWithCSRF(`/api/stories/${story.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ isPublic: newIsPublic }),
                  })
                  setStory({ ...story, isPublic: newIsPublic })
                  if (newIsPublic) {
                    const shareUrl = `${window.location.origin}/stories/${story.id}`
                    await navigator.clipboard.writeText(shareUrl)
                    alert('Story is now public! Anyone with the link can view this story. Link copied to clipboard.')
                  } else {
                    alert('Story is now private.')
                  }
                } catch (err) {
                  console.error('Failed to update sharing:', err)
                }
              }}
              sx={{ color: story.isPublic ? '#2e7d32' : '#546669' }}
              title={story.isPublic ? 'Publicly Shared' : 'Private Story'}
            >
              {story.isPublic ? <Share /> : <ShareOutlined />}
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
                    {story.authorRelationship && ` (${story.authorRelationship})`}
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

            {/* Story Date + Tags */}
            {(story.storyDate || story.tags.length > 0) && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 4 }}>
                {story.storyDate && (
                  <Chip
                    icon={<Schedule sx={{ fontSize: '16px !important' }} />}
                    label={format(new Date(story.storyDate), 'MMMM d, yyyy')}
                    size="small"
                    sx={{
                      backgroundColor: '#f6f3ee',
                      color: '#16334a',
                      fontWeight: 500,
                      '& .MuiChip-icon': { color: '#16334a' },
                    }}
                  />
                )}
                {story.tags.map((tag) => (
                  <Chip key={tag} label={tag} size="small" sx={{ backgroundColor: '#d0e3e6', color: '#16334a' }} />
                ))}
              </Box>
            )}

            {/* Original Audio Player */}
            {(originalAudioId || story.storyType === 'RECORDING') && (
              <Card
                sx={{
                  p: 3,
                  borderRadius: 4,
                  border: '1px solid #d9e7ea',
                  backgroundColor: '#f4f8fa',
                  mb: 4,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: originalAudioId ? 2 : 0 }}>
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: 2,
                      backgroundColor: '#16334a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Mic sx={{ color: '#fff', fontSize: 18 }} />
                  </Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: '#16334a', fontWeight: 700, lineHeight: 1.2 }}>
                      Original Recording
                    </Typography>
                    {originalAudioAsset?.caption && (
                      <Typography variant="caption" sx={{ color: '#546669' }}>
                        {originalAudioAsset.caption}
                      </Typography>
                    )}
                    {!originalAudioId && (
                      <Typography variant="caption" sx={{ color: '#8fa3ab' }}>
                        No audio file attached to this recording.
                      </Typography>
                    )}
                  </Box>
                </Box>
                {originalAudioId && (
                  <audio
                    controls
                    preload="metadata"
                    src={`/api/assets/serve/${originalAudioId}`}
                    style={{ width: '100%', borderRadius: 8 }}
                  />
                )}
              </Card>
            )}


            {/* Transcription — for audio RECORDING stories */}
            {story.storyType === 'RECORDING' && (
              <Box sx={{ mb: 4 }}>
                {(!story.transcriptionStatus || story.transcriptionStatus === 'NONE' || story.transcriptionStatus === 'FAILED') && (
                  <Box
                    sx={{
                      backgroundColor: '#f5f9fa',
                      border: '1px solid #d0e3e6',
                      borderRadius: 3,
                      p: 3,
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ color: '#16334a', mb: 1 }}>
                      Transcribe Audio
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#546669', mb: 2 }}>
                      Generate a text transcript of this audio recording. The transcript is required before you can create a first-person narration rewrite.
                    </Typography>
                    {transcriptionError && (
                      <Typography variant="body2" sx={{ color: 'error.main', mb: 2 }}>
                        {transcriptionError}
                      </Typography>
                    )}
                    <Button
                      variant="contained"
                      size="small"
                      disabled={isTranscribing}
                      onClick={handleTranscribeAudio}
                      startIcon={isTranscribing ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <Mic />}
                      sx={{ backgroundColor: '#16334a', '&:hover': { backgroundColor: '#0f2233' } }}
                    >
                      {isTranscribing ? 'Transcribing…' : story.transcriptionStatus === 'FAILED' ? 'Retry Transcription' : 'Transcribe Audio'}
                    </Button>
                  </Box>
                )}

                {story.transcriptionStatus === 'PENDING' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3, backgroundColor: '#eef3f4', border: '1px solid #d0e3e6', borderRadius: 3 }}>
                    <CircularProgress size={20} sx={{ color: '#16334a' }} />
                    <Typography variant="body2" sx={{ color: '#546669' }}>Transcribing audio…</Typography>
                  </Box>
                )}

                {story.transcriptionStatus === 'COMPLETED' && story.transcript && (
                  <Box sx={{ backgroundColor: '#f5f9fa', border: '1px solid #d0e3e6', borderRadius: 3, p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AutoStories sx={{ fontSize: 18, color: '#16334a' }} />
                        <Typography variant="subtitle2" sx={{ color: '#16334a' }}>Transcript</Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={isTranscribing}
                        onClick={handleTranscribeAudio}
                        sx={{ borderColor: '#d0e3e6', color: '#546669', fontSize: '0.75rem' }}
                      >
                        Re-transcribe
                      </Button>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{ color: '#333', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}
                    >
                      {story.transcript}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* Story Content */}
            <Box
              className="story-content"
              dangerouslySetInnerHTML={{ __html: story.content }}
              sx={{
                color: '#333',
                lineHeight: 1.9,
                fontSize: '1.15rem',
                mb: 6,
                '& p': { mb: 2 },
                '& img': {
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: 3,
                  my: 3,
                  display: 'block',
                  boxShadow: 2,
                },
                '& blockquote': {
                  borderLeft: '4px solid #d0e3e6',
                  pl: 3,
                  py: 1,
                  my: 3,
                  fontStyle: 'italic',
                  color: '#546669',
                  bgcolor: '#f6f3ee',
                  borderRadius: '0 12px 12px 0',
                },
                '& ul, & ol': {
                  pl: 4,
                  mb: 2,
                },
              }}
            />

            {/* AI Narration */}
            <Box sx={{ mb: 6 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <GraphicEq sx={{ color: '#16334a', fontSize: 22 }} />
                <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 700 }}>
                  AI Narration
                </Typography>
                {story.narrationStatus === 'APPROVED' && (
                  <Chip
                    label="Ready"
                    size="small"
                    sx={{ backgroundColor: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }}
                  />
                )}
              </Box>

              <Card sx={{ p: 3, borderRadius: 4, border: '1px solid #ebe8e3', backgroundColor: '#fffdfa' }}>
                <Typography variant="body2" sx={{ color: '#546669', mb: 2 }}>
                  Listen to this story narrated in first-person, synthesized using a family member&apos;s voice.
                </Typography>

                {(!story.narrationStatus || story.narrationStatus === 'NONE') && (
                  <NarrationPreparationBanner
                    mode="opt-in"
                    subjectName={personName(story.subject)}
                    isWorking={isPreparingNarration}
                    error={narrationError}
                    onPrepare={handlePrepareNarration}
                    onDiscardError={() => setNarrationError(null)}
                  />
                )}
                {story.narrationStatus === 'STALE' && (
                  <NarrationPreparationBanner
                    mode="stale"
                    subjectName={personName(story.subject)}
                    isWorking={isPreparingNarration}
                    error={narrationError}
                    onPrepare={handlePrepareNarration}
                    onKeep={async () => { await patchNarration('approve') }}
                    onDiscardError={() => setNarrationError(null)}
                  />
                )}
                {(story.narrationStatus === 'FAILED' ||
                  (story.narrationStatus === 'READY' && !story.narratedContent)) && (
                  <NarrationPreparationBanner
                    mode="failed"
                    subjectName={personName(story.subject)}
                    isWorking={isPreparingNarration}
                    error={narrationError}
                    onPrepare={handlePrepareNarration}
                    onDiscardError={() => setNarrationError(null)}
                  />
                )}
                {story.narrationStatus === 'PENDING' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <CircularProgress size={20} sx={{ color: '#16334a' }} />
                    <Typography variant="body2" sx={{ color: '#546669' }}>Preparing narration…</Typography>
                  </Box>
                )}
                {story.narrationStatus === 'APPROVED' && (
                  <StoryNarrationPlayer
                    storyId={story.id}
                    title={story.title}
                    narrationSource="approved"
                    voiceProfiles={voiceProfiles.map((vp) => ({
                      id: vp.id,
                      name: vp.name,
                      personId: vp.personId,
                      personName: vp.person
                        ? vp.person.nickname || `${vp.person.firstName}${vp.person.lastName ? ' ' + vp.person.lastName : ''}`
                        : null,
                    }))}
                    defaultVoiceProfileId={story.voiceProfile?.id}
                    savedNarration={savedNarration}
                    activeJobId={story.narrationRenderJobId}
                    onSaved={(saved) => {
                      setSavedNarration(saved)
                      fetchStory()
                    }}
                  />
                )}
              </Card>

              {story.narrationStatus === 'READY' && story.narratedContent && (
                <Box sx={{ mt: 2 }}>
                  <NarrationReviewPanel
                    subjectName={personName(story.subject)}
                    originalContent={story.content}
                    initialNarratedContent={story.narratedContent}
                    narrationModel={story.narrationModel}
                    onSaveDraft={async (draft) => { await patchNarration('update', draft) }}
                    onApprove={async (draft) => { await patchNarration('approve', draft) }}
                    onDiscard={async () => { await patchNarration('discard') }}
                    onRepolish={handlePrepareNarration}
                  />
                </Box>
              )}
            </Box>

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

export async function getServerSideProps() {
  return { props: {} }
}
