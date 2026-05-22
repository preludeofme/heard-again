import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { fetchWithCSRF } from '@/lib/api-client'
import Head from 'next/head'
import {
  Box, Typography, Card, CardContent, Button, TextField,
  IconButton, Avatar, CircularProgress, Alert, Container,
  MenuItem, Select, FormControl, InputLabel, Divider,
  ToggleButtonGroup, ToggleButton
} from '@mui/material'
import { 
  ArrowBack as ArrowBackIcon,
  MicNoneOutlined as MicIcon,
  AutoStoriesOutlined as AutoStoriesIcon,
  CheckCircleOutline as CheckIcon
} from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'
import { AudioRecorder } from '@/components/audio/AudioRecorder'
import { MemberSwitcherFlyout } from '@/components/layout/MemberSwitcherFlyout'
import { RichTextEditor } from '@/components/editor/RichTextEditor'

const RELATIONSHIP_OPTIONS = [
  { value: 'Self', label: 'Self' },
  { value: 'Dad', label: 'Dad' },
  { value: 'Mother', label: 'Mother' },
  { value: 'Sister', label: 'Sister' },
  { value: 'Brother', label: 'Brother' },
  { value: 'Child', label: 'Child' },
  { value: 'Grandchild', label: 'Grandchild' },
  { value: 'Grandparent', label: 'Grandparent' },
  { value: 'Spouse', label: 'Spouse' },
  { value: 'Family', label: 'Family' },
  { value: 'Friend', label: 'Friend' },
  { value: 'Other', label: 'Other' },
]

export default function PublicContributePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { subjectId, storyType: storyTypeParam } = router.query
  const storyTypeValue = Array.isArray(storyTypeParam) ? storyTypeParam[0] : storyTypeParam

  const [subject, setSubject] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchAnchorEl, setSearchAnchorEl] = useState<HTMLElement | null>(null)

  const [storyTitle, setStoryTitle] = useState('')
  const [storyContent, setStoryContent] = useState('')
  const [storyDate, setStoryDate] = useState('')
  const [location, setLocation] = useState('')
  const [authorRelationship, setAuthorRelationship] = useState('')
  const [visibility, setVisibility] = useState<'PUBLIC' | 'FAMILY_ONLY' | 'FRIENDS_AND_FAMILY'>('FAMILY_ONLY')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [showAudio, setShowAudio] = useState(false)

  useEffect(() => {
    if (storyTypeValue === 'voice') setShowAudio(true)
  }, [storyTypeValue])

  useEffect(() => {
    if (!subjectId) return

    const fetchSubject = async () => {
      try {
        const res = await fetch(`/api/people/${subjectId}`)
        if (res.ok) {
          const data = await res.json()
          setSubject(data.data)
        } else {
          setError('Family member not found')
        }
      } catch (err) {
        setError('Failed to load family member info')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSubject()
  }, [subjectId])

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!storyContent.trim() || !subjectId) return

    setIsSubmitting(true)
    try {
      const res = await fetchWithCSRF('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: storyTitle || 'Untitled Story',
          content: storyContent,
          subjectId,
          authorRelationship,
          storyDate: storyDate || undefined,
          location: location || undefined,
          storyType: 'MEMORY',
          status: 'PUBLISHED',
          visibility,
        })
      })

      if (res.ok) {
        setIsSuccess(true)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to submit story')
      }
    } catch (err) {
      setError('An error occurred during submission')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAudioComplete = async (audioBlob: Blob, duration: number) => {
    setIsSubmitting(true)
    try {
      const filename = `recording.${audioBlob.type.includes('mp4') ? 'mp4' : 'webm'}`

      // 1. Request presigned upload URL
      const uploadReqRes = await fetchWithCSRF('/api/assets/request-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, mimeType: audioBlob.type, fileSize: audioBlob.size }),
      })
      if (!uploadReqRes.ok) {
        const errData = await uploadReqRes.json().catch(() => ({}))
        throw new Error((errData as any).error || 'Failed to request upload URL')
      }
      const { assetId, uploadUrl } = await uploadReqRes.json() as { assetId: string; uploadUrl: string }

      // 2. PUT directly to R2 — bypasses Vercel body size limit and ClamAV pipeline
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': audioBlob.type },
        body: audioBlob,
      })
      if (!putRes.ok) throw new Error('Storage upload failed')

      // 3. Create story
      const res = await fetchWithCSRF('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: storyTitle || `Audio Recording ${new Date().toLocaleDateString()}`,
          content: `Audio recording (${Math.round(duration)} seconds)`,
          subjectId,
          authorRelationship,
          storyDate: storyDate || undefined,
          location: location || undefined,
          storyType: 'RECORDING',
          assetIds: [assetId],
          status: 'PUBLISHED',
          visibility,
        }),
      })

      if (res.ok) {
        setIsSuccess(true)
      } else {
        const data = await res.json()
        setError((data as any).error || 'Failed to submit story')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during audio submission')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading && subjectId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!subjectId) {
    return (
      <Layout>
        <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ mb: 3, color: '#16334a', fontWeight: 600, fontFamily: 'var(--font-newsreader), serif' }}>
            Who is this story about?
          </Typography>
          <Typography variant="body1" sx={{ mb: 4, color: '#546669' }}>
            Search for a family member below to start sharing a memory.
          </Typography>
          
          <Box sx={{ textAlign: 'left', mb: 4 }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={(e) => setSearchAnchorEl(e.currentTarget)}
              sx={{ borderRadius: 2, color: '#16334a', borderColor: '#16334a', py: 1.5, fontSize: '1rem' }}
            >
              Search for a family member…
            </Button>
            <MemberSwitcherFlyout
              anchorEl={searchAnchorEl}
              onClose={() => setSearchAnchorEl(null)}
              onMemberSelect={(member) => {
                setSearchAnchorEl(null)
                router.push(`/stories/contribute?subjectId=${member.id}`, undefined, { shallow: true })
              }}
            />
          </Box>

          <Divider sx={{ my: 4 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Or
            </Typography>
          </Divider>

          <Button 
            variant="outlined" 
            onClick={() => router.push('/legacy?lens=stories')} 
            sx={{ borderRadius: 2, color: '#16334a', borderColor: '#16334a' }}
          >
            Browse all Memories
          </Button>
        </Container>
      </Layout>
    )
  }

  if (isSuccess) {
    return (
      <Layout>
        <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
          <CheckIcon sx={{ fontSize: 64, color: '#2e7d32', mb: 3 }} />
          <Typography variant="h3" className="serif-font" sx={{ mb: 2, color: '#16334a' }}>
            Thank you!
          </Typography>
          <Typography variant="h6" sx={{ mb: 4, color: '#546669' }}>
            Your story about {subject?.firstName} has been saved to the family story.
          </Typography>

          {status === 'authenticated' ? (
            <Box sx={{ mb: 4 }}>
              <Button 
                fullWidth 
                variant="contained" 
                onClick={() => router.push(`/profile/${subjectId}`)}
                sx={{ bgcolor: '#1a6b5a', borderRadius: 2, py: 1.5, '&:hover': { bgcolor: '#145a4b' } }}
              >
                View {subject?.firstName}&apos;s Profile
              </Button>
            </Box>
          ) : (
            <Card sx={{ bgcolor: '#f6f3ee', p: 4, borderRadius: 3, textAlign: 'left', mb: 4 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#16334a' }}>
                Want to see your story and others?
              </Typography>
              <Typography variant="body2" sx={{ mb: 3, color: '#546669' }}>
                Create a free account to keep track of your contributions and follow the family story as it grows.
              </Typography>
              <Button 
                fullWidth 
                variant="contained" 
                onClick={() => router.push('/signup')}
                sx={{ bgcolor: '#16334a', borderRadius: 2 }}
              >
                Create Free Account
              </Button>
            </Card>
          )}
          <Button variant="text" onClick={() => router.push('/')}>Return to Homepage</Button>
        </Container>
      </Layout>
    )
  }

  return (
    <Layout>
      <Head>
        <title>Tell a story about {subject?.firstName} - Heard Again</title>
      </Head>
      <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4', py: { xs: 4, md: 8 } }}>
        <Container maxWidth="md">
          <IconButton onClick={() => router.back()} sx={{ mb: 2, color: '#16334a' }}>
            <ArrowBackIcon />
          </IconButton>
          
          <Box sx={{ mb: 6, textAlign: 'center' }}>
            <Avatar 
              src={subject?.avatarUrl} 
              sx={{ width: 120, height: 120, mx: 'auto', mb: 3, boxShadow: 3 }}
            >
              {subject?.firstName?.[0]}
            </Avatar>
            <Typography variant="h2" className="serif-font" sx={{ color: '#16334a', mb: 1 }}>
              Tell a story about {subject?.firstName}
            </Typography>
            <Typography variant="h6" sx={{ color: '#546669', maxWidth: 600, mx: 'auto' }}>
              Share a memory, an anecdote, or a message. Help us preserve the legacy for generations to come.
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>{error}</Alert>}

          <Box>
            <Box>
              <Card sx={{ borderRadius: 4, boxShadow: 2, overflow: 'hidden' }}>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
                    <Button 
                      variant={!showAudio ? "contained" : "outlined"}
                      startIcon={<AutoStoriesIcon />}
                      onClick={() => setShowAudio(false)}
                      sx={{ 
                        flex: 1, 
                        bgcolor: !showAudio ? '#16334a' : 'transparent',
                        borderColor: '#16334a',
                        color: !showAudio ? 'white' : '#16334a',
                        borderRadius: 2
                      }}
                    >
                      Write it down
                    </Button>
                    <Button 
                      variant={showAudio ? "contained" : "outlined"}
                      startIcon={<MicIcon />}
                      onClick={() => setShowAudio(true)}
                      sx={{ 
                        flex: 1, 
                        bgcolor: showAudio ? '#16334a' : 'transparent',
                        borderColor: '#16334a',
                        color: showAudio ? 'white' : '#16334a',
                        borderRadius: 2
                      }}
                    >
                      Record Audio
                    </Button>
                  </Box>

                  <Box component="form" onSubmit={handleSubmit}>
                    <FormControl fullWidth sx={{ mb: 3 }}>
                      <InputLabel id="relationship-label">Your Relationship</InputLabel>
                      <Select
                        labelId="relationship-label"
                        value={authorRelationship}
                        label="Your Relationship"
                        onChange={(e) => setAuthorRelationship(e.target.value)}
                        required
                      >
                        {RELATIONSHIP_OPTIONS.map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Box sx={{ mb: 3 }}>
                      <Typography variant="caption" sx={{ color: '#546669', mb: 1, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Who can see this story?
                      </Typography>
                      <ToggleButtonGroup
                        value={visibility}
                        exclusive
                        onChange={(_, val) => { if (val) setVisibility(val) }}
                        size="small"
                        sx={{ gap: 1, flexWrap: 'wrap' }}
                      >
                        <ToggleButton
                          value="FAMILY_ONLY"
                          sx={{
                            borderRadius: '20px !important',
                            border: '1px solid #c3c7cd !important',
                            px: 2.5,
                            textTransform: 'none',
                            fontWeight: 600,
                            '&.Mui-selected': { bgcolor: '#e8f4f8', color: '#16334a', borderColor: '#90caf9 !important' },
                          }}
                        >
                          Family Only
                        </ToggleButton>
                        <ToggleButton
                          value="FRIENDS_AND_FAMILY"
                          sx={{
                            borderRadius: '20px !important',
                            border: '1px solid #c3c7cd !important',
                            px: 2.5,
                            textTransform: 'none',
                            fontWeight: 600,
                            '&.Mui-selected': { bgcolor: '#f3e5f5', color: '#6a1b9a', borderColor: '#ce93d8 !important' },
                          }}
                        >
                          Friends &amp; Family
                        </ToggleButton>
                        <ToggleButton
                          value="PUBLIC"
                          sx={{
                            borderRadius: '20px !important',
                            border: '1px solid #c3c7cd !important',
                            px: 2.5,
                            textTransform: 'none',
                            fontWeight: 600,
                            '&.Mui-selected': { bgcolor: '#e8f5e9', color: '#2e7d32', borderColor: '#a5d6a7 !important' },
                          }}
                        >
                          Public
                        </ToggleButton>
                      </ToggleButtonGroup>
                      <Typography variant="caption" sx={{ color: '#546669', display: 'block', mt: 1 }}>
                        {visibility === 'FAMILY_ONLY' && 'Only family members can see this story.'}
                        {visibility === 'FRIENDS_AND_FAMILY' && 'Friends and family members can see this story.'}
                        {visibility === 'PUBLIC' && 'Anyone can discover and view this story.'}
                      </Typography>
                    </Box>

                    <TextField
                      fullWidth
                      label="Story Title (Optional)"
                      placeholder="Give your memory a title"
                      value={storyTitle}
                      onChange={(e) => setStoryTitle(e.target.value)}
                      sx={{ mb: 3 }}
                    />
                    
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 3 }}>
                      <Box>
                        <TextField
                          fullWidth
                          label="When did this happen? (Optional)"
                          type="date"
                          value={storyDate}
                          onChange={(e) => setStoryDate(e.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Box>
                      <Box>
                        <TextField
                          fullWidth
                          label="Where did this happen? (Optional)"
                          placeholder="City, state, or specific place"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                        />
                      </Box>
                    </Box>

                    {showAudio ? (
                      <Box sx={{ mt: 2 }}>
                        <AudioRecorder 
                          onRecordingComplete={handleAudioComplete}
                          onCancel={() => setShowAudio(false)}
                        />
                      </Box>
                    ) : (
                      <>
                        <Box sx={{ mb: 4 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1, color: '#16334a' }}>Share your memory</Typography>
                          <RichTextEditor
                            content={storyContent}
                            onChange={(html) => setStoryContent(html)}
                            placeholder="Start writing here..."
                          />
                        </Box>
                        <Button
                          fullWidth
                          type="submit"
                          variant="contained"
                          disabled={isSubmitting || !storyContent.trim()}
                          sx={{ 
                            bgcolor: '#16334a', 
                            py: 1.5, 
                            borderRadius: 2,
                            fontSize: '1.1rem'
                          }}
                        >
                          {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Submit Story'}
                        </Button>
                      </>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Container>
      </Box>
    </Layout>
  )
}


export async function getServerSideProps() { return { props: {} } }
