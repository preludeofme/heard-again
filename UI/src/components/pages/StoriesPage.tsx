import { Box, Typography, Card, CardContent, Button, Grid, TextField, IconButton, Avatar, Chip, Dialog, Collapse, Paper } from '@mui/material'
import { 
  MicNoneOutlined as MicIcon, 
  AutoStoriesOutlined as AutoStoriesIcon, 
  ShareOutlined as Share,
  ArrowForwardOutlined as ArrowForwardIcon, 
  CloseOutlined as CloseIcon, 
} from '@mui/icons-material'
import { StoryContribution } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { AudioRecorder } from '@/components/audio/AudioRecorder'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { ProfileColors } from '@/components/profile/ProfileConstants'

function stripHtml(html: string) {
  if (typeof window === 'undefined') return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

interface StoriesPageProps {
  stories: StoryContribution[]
  selectedFamilyMember?: {
    id: string
    firstName: string
    lastName?: string | null
    displayName?: string | null
    avatarUrl?: string | null
  } | null
  onSubmitStory?: (title: string, content: string, storyDate?: string, location?: string, authorRelationship?: string) => Promise<void>
  onSubmitAudio?: (audioBlob: Blob, duration: number, title?: string, authorRelationship?: string) => Promise<void>
  isLens?: boolean
}

const getDisplayName = (member: StoriesPageProps['selectedFamilyMember']) => {
  if (!member) return 'their'
  return member.displayName || `${member.firstName}${member.lastName ? ` ${member.lastName}` : ''}`
}

export function StoriesPage({ stories, selectedFamilyMember, onSubmitStory, onSubmitAudio, isLens = false }: StoriesPageProps) {
  const [storyTitle, setStoryTitle] = useState('')
  const [storyContent, setStoryContent] = useState('')
  const [storyDate, setStoryDate] = useState('')
  const [storyLocation, setStoryLocation] = useState('')
  const [authorRelationship, setAuthorRelationship] = useState('')
  const [showOptional, setShowOptional] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAudioDialog, setShowAudioDialog] = useState(false)
  const [isSubmittingAudio, setIsSubmittingAudio] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'written' | 'audio'>('all')
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const router = useRouter()

  const filteredStories = stories.filter(s => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'written') return s.type === 'text' || !s.type
    if (activeFilter === 'audio') return s.type === 'audio'
    return true
  })

  const featuredStory = stories.find(s => s.hasNarration) || stories[0]
  const otherStories = filteredStories.filter(s => s.id !== featuredStory?.id)

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const handlePostMemory = async () => {
    if (!storyContent.trim() || !onSubmitStory) return
    setIsSubmitting(true)
    try {
      await onSubmitStory(
        storyTitle,
        storyContent,
        storyDate || undefined,
        storyLocation || undefined,
        authorRelationship || undefined,
      )
      setStoryTitle('')
      setStoryContent('')
      setStoryDate('')
      setStoryLocation('')
      setAuthorRelationship('')
      setShowOptional(false)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleAudioComplete = async (audioBlob: Blob, duration: number) => {
    if (!onSubmitAudio) return
    setIsSubmittingAudio(true)
    try {
      await onSubmitAudio(audioBlob, duration, undefined, authorRelationship || undefined)
      setShowAudioDialog(false)
    } finally {
      setIsSubmittingAudio(false)
    }
  }

  const initials = selectedFamilyMember?.firstName?.[0] || '?'

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: ProfileColors.surface, pb: 10 }}>
      
      {!isLens && (
        <>
          <Box sx={{ px: { xs: 3, md: 8 }, py: { xs: 4, md: 8 }, minHeight: 'calc(100vh - 290px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Grid container spacing={4} alignItems="center">
              <Grid size={{ xs: 12, lg: 7 }}>
                <Typography variant="h1" className="serif-font" sx={{ fontSize: { xs: '3rem', md: '4.5rem' }, color: ProfileColors.primary, fontWeight: 600, lineHeight: 1.1, mb: 4, fontStyle: 'italic' }}>
                  Help us tell {getDisplayName(selectedFamilyMember)}'s story.
                </Typography>
                <Typography variant="h6" sx={{ color: ProfileColors.onSurfaceVariant, maxWidth: 500, lineHeight: 1.6, fontFamily: 'var(--font-newsreader), serif', fontSize: '1.25rem', mb: 4 }}>
                  We are building a living archive of {getDisplayName(selectedFamilyMember)}'s life. Your memories, voice, and stories keep this legacy vibrant for generations to come.
                </Typography>
                <Button variant="contained" startIcon={<Share />} onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Link copied!'); }} sx={{ backgroundColor: ProfileColors.primary, borderRadius: '999px', px: 3, py: 1.5 }}>
                  Invite family to contribute
                </Button>
              </Grid>
              <Grid size={{ xs: 12, lg: 5 }}>
                <Box sx={{ aspectRatio: '4/5', borderRadius: 6, overflow: 'hidden', boxShadow: '0 20px 80px rgba(0,0,0,0.12)', transform: 'rotate(2deg)', bgcolor: ProfileColors.surfaceContainerHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `12px solid #fff` }}>
                  {selectedFamilyMember?.avatarUrl ? <Avatar src={selectedFamilyMember.avatarUrl} variant="square" sx={{ width: '100%', height: '100%' }} /> : <Typography sx={{ fontSize: '10rem', color: ProfileColors.primary, fontWeight: 700 }}>{initials}</Typography>}
                </Box>
              </Grid>
            </Grid>
          </Box>
        </>
      )}

      <Box sx={{ px: { xs: 2, md: 8 }, pt: isLens ? 4 : 8 }}>
        <Box sx={{ mb: 6, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'flex-end' }, gap: 3 }}>
          <Box>
            <Typography sx={{ fontFamily: 'var(--font-manrope), sans-serif', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: ProfileColors.onSurfaceVariant, mb: 1 }}>The Chronicles</Typography>
            <Typography variant="h2" className="serif-font" sx={{ color: ProfileColors.primary, fontWeight: 700, fontSize: { xs: '2.5rem', md: '3.5rem' }, lineHeight: 1, fontStyle: 'italic' }}>Collected Stories</Typography>
          </Box>

          <Paper elevation={0} sx={{ display: 'flex', p: 0.75, borderRadius: '999px', backgroundColor: ProfileColors.surfaceContainerLow, border: `1px solid ${ProfileColors.outlineVariant}20` }}>
            {([ { label: 'All', value: 'all' }, { label: 'Spoken', value: 'audio' }, { label: 'Written', value: 'written' } ] as const).map((opt) => (
              <Button key={opt.value} onClick={() => setActiveFilter(opt.value)} sx={{ px: 3, py: 1, borderRadius: '999px', textTransform: 'none', fontWeight: 600, fontSize: '0.9rem', color: activeFilter === opt.value ? ProfileColors.primary : ProfileColors.onSurfaceVariant, backgroundColor: activeFilter === opt.value ? ProfileColors.surfaceContainerLowest : 'transparent', boxShadow: activeFilter === opt.value ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>{opt.label}</Button>
            ))}
          </Paper>
        </Box>

        {filteredStories.length === 0 ? (
          <Box sx={{ py: 12, textAlign: 'center', backgroundColor: ProfileColors.surfaceContainerLow, borderRadius: 8, border: `2px dashed ${ProfileColors.outlineVariant}30` }}>
            <AutoStoriesIcon sx={{ fontSize: 64, color: ProfileColors.outlineVariant, mb: 2, opacity: 0.5 }} />
            <Typography variant="h5" className="serif-font" sx={{ color: ProfileColors.primary, mb: 1 }}>No stories told yet</Typography>
            <Typography variant="body2" sx={{ color: ProfileColors.onSurfaceVariant, mb: 4 }}>Be the first to share a memory of {getDisplayName(selectedFamilyMember)}.</Typography>
          </Box>
        ) : (
          <Grid container spacing={6}>
            {featuredStory && activeFilter === 'all' && (
              <Grid size={12}>
                <Card onClick={() => router.push(`/stories/${featuredStory.id}`)} sx={{ borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 400, cursor: 'pointer', boxShadow: '0 30px 90px rgba(0,0,0,0.08)', border: `1px solid ${ProfileColors.outlineVariant}15` }}>
                  <Box sx={{ width: { xs: '100%', md: '45%' }, bgcolor: ProfileColors.primaryContainer, position: 'relative', overflow: 'hidden' }}>
                    {featuredStory.authorAvatarUrl && <Box component="img" src={featuredStory.authorAvatarUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />}
                    <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 4, background: 'linear-gradient(transparent, rgba(0,0,0,0.6))', color: '#fff' }}>
                      <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700, mb: 1, display: 'block' }}>Featured Memory</Typography>
                      <Typography variant="h4" className="serif-font" sx={{ fontWeight: 700 }}>{featuredStory.authorName}</Typography>
                    </Box>
                  </Box>
                  <CardContent sx={{ flex: 1, p: { xs: 4, md: 8 }, display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: ProfileColors.surfaceContainerLowest }}>
                    <Typography variant="h3" className="serif-font" sx={{ color: ProfileColors.primary, mb: 3, fontWeight: 700, fontSize: { xs: '2rem', md: '2.5rem' }, lineHeight: 1.2 }}>{featuredStory.title || featuredStory.authorName + "'s Story"}</Typography>
                    <Typography variant="body1" sx={{ color: ProfileColors.onSurfaceVariant, mb: 4, lineHeight: 1.8, fontSize: '1.2rem', fontFamily: 'var(--font-newsreader), serif', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{featuredStory.type === 'audio' ? featuredStory.content : stripHtml(featuredStory.content)}</Typography>
                    <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Button variant="contained" sx={{ borderRadius: '999px', bgcolor: ProfileColors.primary, px: 4, py: 1.5 }}>Read Full Chapter</Button>
                      {featuredStory.type === 'audio' && <MicIcon sx={{ color: ProfileColors.primary }} />}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {otherStories.map((story) => (
              <Grid key={story.id} size={{ xs: 12, md: 6, lg: 4 }}>
                <Card onClick={() => router.push(`/stories/${story.id}`)} sx={{ borderRadius: 5, p: 4, height: '100%', backgroundColor: story.type === 'audio' ? ProfileColors.surfaceContainerLow : ProfileColors.surfaceContainerLowest, border: `1px solid ${ProfileColors.outlineVariant}15`, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer', display: 'flex', flexDirection: 'column', '&:hover': { transform: 'translateY(-12px)', boxShadow: '0 20px 60px rgba(0,0,0,0.06)' } }}>
                  <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar src={story.authorAvatarUrl} sx={{ width: 32, height: 32, border: `1px solid ${ProfileColors.outlineVariant}30` }} />
                      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: ProfileColors.primary }}>{story.authorName}</Typography>
                    </Box>
                    <Chip label={story.type === 'audio' ? 'Spoken' : 'Written'} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: ProfileColors.surfaceContainerHigh, color: ProfileColors.onSurfaceVariant }} />
                  </Box>
                  <Typography variant="h5" className="serif-font" sx={{ color: ProfileColors.primary, mb: 2, fontWeight: 700, lineHeight: 1.3 }}>{story.title || "A Memory Shared"}</Typography>
                  <Typography variant="body2" sx={{ color: ProfileColors.onSurfaceVariant, lineHeight: 1.7, fontSize: '1rem', fontFamily: 'var(--font-newsreader), serif', mb: 3, flexGrow: 1, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{story.type === 'audio' ? story.content : stripHtml(story.content)}</Typography>
                  <Box sx={{ pt: 2, borderTop: `1px solid ${ProfileColors.outlineVariant}10`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: ProfileColors.onSurfaceVariant, opacity: 0.6 }}>{formatDistanceToNow(new Date(story.createdAt), { addSuffix: true })}</Typography>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <Dialog open={showAudioDialog} onClose={() => !isSubmittingAudio && setShowAudioDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <Box sx={{ p: 0 }}>
          <IconButton onClick={() => setShowAudioDialog(false)} disabled={isSubmittingAudio} sx={{ position: 'absolute', right: 8, top: 8, zIndex: 1 }}><CloseIcon /></IconButton>
          <Box sx={{ p: 4, pb: 0 }}>
            <Typography variant="h5" className="serif-font" sx={{ mb: 2, color: ProfileColors.primary }}>Record your story</Typography>
            <TextField fullWidth size="small" label="Your Relationship" placeholder="e.g. Son, Daughter, Grandchild, Friend" value={authorRelationship} onChange={(e) => setAuthorRelationship(e.target.value)} sx={{ mb: 3 }} />
          </Box>
          <AudioRecorder onRecordingComplete={handleAudioComplete} onCancel={() => setShowAudioDialog(false)} />
        </Box>
      </Dialog>
    </Box>
  )
}
