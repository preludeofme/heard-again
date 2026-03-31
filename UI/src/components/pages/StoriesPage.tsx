import { Box, Typography, Card, CardContent, Button, Grid, TextField, IconButton, Avatar, Chip, Dialog, Collapse } from '@mui/material'
import { Mic as MicIcon, AutoStories as AutoStoriesIcon, AttachFile as AttachFileIcon, AddPhotoAlternate as AddPhotoIcon, PlayArrow as PlayIcon, Schedule as ScheduleIcon, ArrowForward as ArrowForwardIcon, Close as CloseIcon, KeyboardArrowDown as ArrowDownIcon } from '@mui/icons-material'
import { StoryContribution } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { EmptyState } from '@/components/feedback/UIStates'
import { AudioRecorder } from '@/components/audio/AudioRecorder'

interface StoriesPageProps {
  stories: StoryContribution[]
  selectedFamilyMember?: {
    id: string
    firstName: string
    lastName?: string | null
    displayName?: string | null
  } | null
  onSubmitStory?: (title: string, content: string, storyDate?: string, location?: string) => Promise<void>
  onSubmitAudio?: (audioBlob: Blob, duration: number) => Promise<void>
}

const getDisplayName = (member: StoriesPageProps['selectedFamilyMember']) => {
  if (!member) return 'their'
  return member.displayName || `${member.firstName}${member.lastName ? ` ${member.lastName}` : ''}`
}

export function StoriesPage({ stories, selectedFamilyMember, onSubmitStory, onSubmitAudio }: StoriesPageProps) {
  const [storyTitle, setStoryTitle] = useState('')
  const [storyContent, setStoryContent] = useState('')
  const [storyDate, setStoryDate] = useState('')
  const [storyLocation, setStoryLocation] = useState('')
  const [showOptional, setShowOptional] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAudioDialog, setShowAudioDialog] = useState(false)
  const [isSubmittingAudio, setIsSubmittingAudio] = useState(false)
  const router = useRouter()

  const handlePostMemory = async () => {
    if (!storyContent.trim() || !onSubmitStory) return
    setIsSubmitting(true)
    try {
      await onSubmitStory(
        storyTitle,
        storyContent,
        storyDate || undefined,
        storyLocation || undefined,
      )
      setStoryTitle('')
      setStoryContent('')
      setStoryDate('')
      setStoryLocation('')
      setShowOptional(false)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleAudioComplete = async (audioBlob: Blob, duration: number) => {
    if (!onSubmitAudio) return
    setIsSubmittingAudio(true)
    try {
      await onSubmitAudio(audioBlob, duration)
      setShowAudioDialog(false)
    } finally {
      setIsSubmittingAudio(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4' }}>
      {/* Hero Section */}
      <Box sx={{ px: { xs: 3, md: 8 }, py: { xs: 4, md: 8 }, minHeight: 'calc(100vh - 290px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Grid container spacing={4} alignItems="center">
          <Grid size={{ xs: 12, lg: 7 }}>
            <Typography 
              variant="h1" 
              className="serif-font" 
              sx={{ 
                fontSize: { xs: '3rem', md: '4.5rem' },
                color: '#16334a',
                fontWeight: 600,
                lineHeight: 1.1,
                mb: 4,
                fontStyle: 'italic'
              }}
            >
              Help us tell {getDisplayName(selectedFamilyMember)}'s story.
            </Typography>
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#546669',
                maxWidth: 500,
                lineHeight: 1.6
              }}
            >
              We are building a living archive of {getDisplayName(selectedFamilyMember)}'s life. Your memories, voice, and stories are the threads that keep {selectedFamilyMember ? 'their' : 'his'} legacy vibrant for the generations to come.
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, lg: 5 }} sx={{ position: 'relative' }}>
            <Box
              sx={{
                aspectRatio: '4/5',
                borderRadius: 4,
                overflow: 'hidden',
                boxShadow: 4,
                transform: 'rotate(2deg)',
                transition: 'transform 0.7s',
                maxHeight: { xs: '400px', md: '500px' },
                '&:hover': {
                  transform: 'rotate(0deg)',
                },
              }}
            >
              <Avatar
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCE6G2ba8wPd1OUCIlR2SNCWMhXSpZqRXMGA-auLhpR7gdEzS8PmWdIhULhGftOvD6SNbz7D796CNvDySAbq32Db_HzZEk1OlUDYb1QCsjF7h53Z3mCcuEU1hdwLOhAZWeK8JEC_eJHW2To1WqsI0XSwxyF_USNIljlTT-kRjjEsQF6XPqnMdE52F_tMU4HqEk6NlfAuy9df8rUQt5p4d_t0jESsosqGtCeDDbv6cnkwVrTo_KE6mf-5pTdF497qGFsmopSDSWGHPQ"
                variant="square"
                sx={{ 
                  width: '100%', 
                  height: '100%',
                  '& img': {
                    objectFit: 'cover'
                  }
                }}
              />
            </Box>
            {/* Floating Quote Card */}
            <Box
              sx={{
                position: 'absolute',
                bottom: -32,
                left: -32,
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(24px)',
                p: 3,
                borderRadius: 3,
                boxShadow: 4,
                maxWidth: 240,
                display: { xs: 'none', md: 'block' }
              }}
            >
              <Typography 
                variant="h6" 
                className="serif-font" 
                sx={{ 
                  color: '#16334a',
                  mb: 1,
                  fontStyle: 'italic'
                }}
              >
                "The best way to remember is to share."
              </Typography>
              <Typography variant="caption" sx={{ color: '#546669' }}>
                — The Living Archive
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Scroll Indicator */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mt: { xs: 2, md: 4 },
            mb: 2,
            animation: 'bounce 2s infinite',
            '@keyframes bounce': {
              '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' },
              '40%': { transform: 'translateY(-10px)' },
              '60%': { transform: 'translateY(-5px)' },
            },
          }}
        >
          <Typography 
            variant="body2" 
            sx={{ 
              color: '#546669', 
              mb: 1,
              fontSize: '0.875rem',
              textTransform: 'uppercase',
              letterSpacing: 1,
              opacity: 0.7
            }}
          >
            Scroll to explore
          </Typography>
          <IconButton
            sx={{
              color: '#16334a',
              backgroundColor: 'rgba(22, 51, 74, 0.1)',
              '&:hover': {
                backgroundColor: 'rgba(22, 51, 74, 0.2)',
              },
            }}
            onClick={() => {
              const element = document.getElementById('contribution-hub')
              element?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            <ArrowDownIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Contribution Hub */}
      <Box id="contribution-hub" sx={{ px: { xs: 3, md: 8 }, mb: 8 }}>
        <Box sx={{ backgroundColor: '#f6f3ee', borderRadius: 4, p: { xs: 4, md: 6 } }}>
          <Grid container spacing={4}>
            {/* Record a Memory */}
            <Grid size={{ xs: 12, lg: 6 }}>
              <Box sx={{ backgroundColor: '#ffffff', borderRadius: 3, p: 4, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#d0e3e6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MicIcon sx={{ color: '#16334a', fontSize: 28 }} />
                  </Box>
                  <Typography variant="h4" className="serif-font" sx={{ color: '#16334a' }}>
                    Record a Memory
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: '#546669', mb: 4, lineHeight: 1.6 }}>
                  Speak from the heart. Share a favorite anecdote about {getDisplayName(selectedFamilyMember)}, a piece of advice {selectedFamilyMember ? 'they' : 'he'} gave, or just a simple greeting.
                </Typography>
                {/* Waveform Placeholder */}
                <Box sx={{ 
                  height: 96, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: 0.5, 
                  mb: 4, 
                  backgroundColor: '#ebe8e3', 
                  borderRadius: 3,
                  px: 3
                }}>
                  {[...Array(8)].map((_, i) => (
                    <Box
                      key={i}
                      sx={{
                        height: [16, 32, 48, 24, 64, 40, 56, 32][i],
                        width: 4,
                        backgroundColor: '#e0c29a',
                        borderRadius: 1,
                      }}
                    />
                  ))}
                </Box>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={() => setShowAudioDialog(true)}
                  sx={{
                    background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
                    py: 2,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    boxShadow: 3,
                    '&:active': {
                      transform: 'scale(0.98)',
                    }
                  }}
                  startIcon={<MicIcon />}
                >
                  Start Recording
                </Button>
              </Box>
            </Grid>

            {/* Write a Story */}
            <Grid size={{ xs: 12, lg: 6 }}>
              <Box sx={{ backgroundColor: '#ffffff', borderRadius: 3, p: 4, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#feddb4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AutoStoriesIcon sx={{ color: '#402e11', fontSize: 28 }} />
                  </Box>
                  <Typography variant="h4" className="serif-font" sx={{ color: '#16334a' }}>
                    Write a Story
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    fullWidth
                    placeholder="Story Title (Optional)"
                    value={storyTitle}
                    onChange={(e) => setStoryTitle(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#ebe8e3',
                        borderRadius: 3,
                        '& fieldset': { border: 'none' },
                        '&:hover fieldset': { border: 'none' },
                        '&.Mui-focused fieldset': { border: 'none' },
                        '&.Mui-focused': { backgroundColor: '#ffffff' }
                      }
                    }}
                  />
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    placeholder={`Share your favorite memory of ${getDisplayName(selectedFamilyMember)}...`}
                    value={storyContent}
                    onChange={(e) => setStoryContent(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#ebe8e3',
                        borderRadius: 3,
                        '& fieldset': { border: 'none' },
                        '&:hover fieldset': { border: 'none' },
                        '&.Mui-focused fieldset': { border: 'none' },
                        '&.Mui-focused': { backgroundColor: '#ffffff' }
                      }
                    }}
                  />

                  {/* Optional date + location toggle */}
                  <Box>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => setShowOptional(p => !p)}
                      sx={{ color: '#546669', fontSize: '0.78rem', textTransform: 'none', px: 0.5, mb: 0.5 }}
                    >
                      {showOptional ? '− Hide details' : '+ Add date & location'}
                    </Button>
                    <Collapse in={showOptional}>
                      <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                        <TextField
                          type="date"
                          size="small"
                          label="Date"
                          InputLabelProps={{ shrink: true }}
                          value={storyDate}
                          onChange={(e) => setStoryDate(e.target.value)}
                          sx={{
                            flex: 1,
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: '#ebe8e3',
                              borderRadius: 2,
                              '& fieldset': { border: 'none' },
                              '&.Mui-focused': { backgroundColor: '#ffffff' },
                            },
                          }}
                        />
                        <TextField
                          size="small"
                          label="Location"
                          placeholder="e.g. Chicago, IL"
                          value={storyLocation}
                          onChange={(e) => setStoryLocation(e.target.value)}
                          sx={{
                            flex: 1,
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: '#ebe8e3',
                              borderRadius: 2,
                              '& fieldset': { border: 'none' },
                              '&.Mui-focused': { backgroundColor: '#ffffff' },
                            },
                          }}
                        />
                      </Box>
                    </Collapse>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton sx={{ color: '#546669' }}>
                        <AttachFileIcon />
                      </IconButton>
                      <IconButton sx={{ color: '#546669' }}>
                        <AddPhotoIcon />
                      </IconButton>
                    </Box>
                    <Button
                      variant="contained"
                      onClick={handlePostMemory}
                      disabled={!storyContent.trim() || isSubmitting}
                      sx={{
                        backgroundColor: '#d0e3e6',
                        color: '#546669',
                        '&:hover': {
                          backgroundColor: '#b7cacd',
                        }
                      }}
                    >
                      {isSubmitting ? 'Posting...' : 'Post Memory'}
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* Recent Contributions */}
      <Box sx={{ px: { xs: 3, md: 8 }, pb: 8 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 6 }}>
          <Box>
            <Typography variant="h3" className="serif-font" sx={{ color: '#16334a', mb: 1, fontStyle: 'italic' }}>
              Recent Contributions
            </Typography>
            <Typography variant="body1" sx={{ color: '#546669' }}>
              Gathering moments from friends and family worldwide.
            </Typography>
          </Box>
          <Button
            variant="text"
            endIcon={<ArrowForwardIcon />}
            sx={{ 
              color: '#16334a', 
              fontWeight: 600,
              '&:hover': {
                transform: 'translateX(4px)',
              }
            }}
          >
            View Archive
          </Button>
        </Box>

        <Grid container spacing={3}>
          {stories.length === 0 ? (
            <Grid size={12}>
              <EmptyState type="stories" onAction={() => {}} />
            </Grid>
          ) : (
            <>
              {stories.map((story, index) => (
            <Grid 
              key={story.id} 
              size={{ xs: 12, md: index === 1 ? 12 : 6, lg: index === 1 ? 12 : 4 }}
            >
              <Card
                onClick={() => router.push(`/stories/${story.id}`)}
                sx={{
                  backgroundColor: story.type === 'audio' ? '#2e4a62' : '#ffffff',
                  color: story.type === 'audio' ? 'white' : 'inherit',
                  p: 4,
                  borderRadius: 4,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.3s',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: 4,
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Avatar
                    src={story.authorAvatarUrl}
                    sx={{ 
                      width: 48, 
                      height: 48,
                      border: story.type === 'audio' ? '2px solid #adcae6' : 'none'
                    }}
                  />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {story.authorName}
                    </Typography>
                    <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7 }}>
                      {story.authorRole}
                    </Typography>
                  </Box>
                </Box>
                
                <Typography 
                  variant="body1" 
                  sx={{ 
                    mb: 3, 
                    flexGrow: 1,
                    lineHeight: 1.6,
                    fontStyle: story.type === 'audio' ? 'italic' : 'normal',
                    fontSize: story.type === 'audio' ? '1.1rem' : '1rem'
                  }}
                >
                  {story.content}
                </Typography>

                {story.type === 'audio' && (
                  <Box sx={{ mt: 'auto' }}>
                    <Box sx={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.3)', 
                      p: 2, 
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2
                    }}>
                      <IconButton sx={{ backgroundColor: 'white', color: '#16334a' }}>
                        <PlayIcon />
                      </IconButton>
                      <Box sx={{ flexGrow: 1, height: 4, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 1, overflow: 'hidden' }}>
                        <Box sx={{ width: '33%', height: '100%', backgroundColor: 'white' }} />
                      </Box>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                        1:42
                      </Typography>
                    </Box>
                  </Box>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, opacity: 0.6 }}>
                  <ScheduleIcon sx={{ fontSize: 16 }} />
                  <Typography variant="caption">
                    {formatDistanceToNow(story.createdAt, { addSuffix: true })}
                  </Typography>
                </Box>
              </Card>
            </Grid>
              ))}
            </>
          )}
        </Grid>
      </Box>

      {/* Footer */}
      <Box sx={{ backgroundColor: '#f6f3ee', py: 10, mt: 8 }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 3, md: 6 } }}>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="h4" className="serif-font" sx={{ color: '#16334a', mb: 3, fontStyle: 'italic' }}>
                Heard Again
              </Typography>
              <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.6 }}>
                Preserving the human soul through the power of voice and story. A digital sanctuary for legacies.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="h6" sx={{ color: '#16334a', mb: 2, fontWeight: 600 }}>
                Archive Sections
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {['The Voice Lab', 'Memory Documents', 'Family Stories'].map((item) => (
                  <Typography 
                    key={item}
                    component="a" 
                    href="#"
                    sx={{ 
                      color: '#546669', 
                      textDecoration: 'none',
                      '&:hover': { color: '#16334a' }
                    }}
                  >
                    {item}
                  </Typography>
                ))}
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="h6" sx={{ color: '#16334a', mb: 2, fontWeight: 600 }}>
                Community
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {['Privacy Settings', 'Terms of Remembrance', 'Support Center'].map((item) => (
                  <Typography 
                    key={item}
                    component="a" 
                    href="#"
                    sx={{ 
                      color: '#546669', 
                      textDecoration: 'none',
                      '&:hover': { color: '#16334a' }
                    }}
                  >
                    {item}
                  </Typography>
                ))}
              </Box>
            </Grid>
          </Grid>
          <Box sx={{ mt: 6, pt: 4, borderTop: '1px solid #dcdad5' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
              <Typography variant="body2" sx={{ color: '#546669', opacity: 0.6 }}>
                © 2024 Heard Again. The Living Archive. All memories preserved.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <IconButton sx={{ color: '#546669' }}>
                  <ScheduleIcon />
                </IconButton>
                <IconButton sx={{ color: '#546669' }}>
                  <ScheduleIcon />
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
      {/* Audio Recording Dialog */}
      <Dialog
        open={showAudioDialog}
        onClose={() => !isSubmittingAudio && setShowAudioDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <Box sx={{ p: 0 }}>
          <IconButton
            onClick={() => setShowAudioDialog(false)}
            disabled={isSubmittingAudio}
            sx={{ position: 'absolute', right: 8, top: 8, zIndex: 1 }}
          >
            <CloseIcon />
          </IconButton>
          <AudioRecorder
            onRecordingComplete={handleAudioComplete}
            onCancel={() => setShowAudioDialog(false)}
          />
        </Box>
      </Dialog>
    </Box>
  )
}
