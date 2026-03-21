import { Box, Typography, Card, CardContent, IconButton, Button, Grid, Chip, Avatar } from '@mui/material'
import { useState } from 'react'
import { PlayArrow as PlayIcon, Favorite as HeartIcon, ArrowForward as ArrowForwardIcon, Mic as MicIcon, Edit as EditIcon, Upload as UploadIcon, Forum as ChatIcon, Pause as PauseIcon } from '@mui/icons-material'
import { LegacySubject, MemoryWallItem } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/router'

interface DashboardProps {
  legacySubject: LegacySubject
  memoryWallItems: MemoryWallItem[]
}

export function Dashboard({ legacySubject, memoryWallItems }: DashboardProps) {
  const router = useRouter()
  const [isPlaying, setIsPlaying] = useState(false)
  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Hero Area with Two Primary Cards */}
      <Box sx={{ mb: 6 }}>
        <Grid container spacing={3}>
          {/* Profile Card */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Card
              sx={{
                backgroundColor: '#ffffff',
                borderRadius: 3,
                p: 4,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: '0 10px 40px rgba(28,28,25,0.06)',
              }}
            >
              <Box sx={{ position: 'relative', mb: 3 }}>
                <Avatar
                  src={legacySubject.avatarUrl}
                  sx={{ 
                    width: 128, 
                    height: 128, 
                    border: '4px solid #f0ede8'
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    backgroundColor: '#e0c29a',
                    color: '#281801',
                    p: 1,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <HeartIcon sx={{ fontSize: 16 }} />
                </Box>
              </Box>
              <Typography variant="h3" className="serif-font" sx={{ color: '#16334a', mb: 1 }}>
                {legacySubject.fullName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontStyle: 'italic', fontWeight: 500 }}>
                {legacySubject.lifespanText}
              </Typography>
              <Typography variant="body1" sx={{ lineHeight: 1.6, maxWidth: 250 }}>
                {legacySubject.bio}
              </Typography>
            </Card>
          </Grid>

          {/* Voice Sample Card */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Card
              sx={{
                backgroundColor: '#f0ede8',
                borderRadius: 3,
                p: 4,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                  <Typography variant="h4" className="serif-font" sx={{ color: '#16334a' }}>
                    Voice Sample
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Generated Legacy Clone — High Fidelity
                  </Typography>
                </Box>
                <IconButton
                  onClick={() => setIsPlaying(!isPlaying)}
                  sx={{
                    backgroundColor: '#16334a',
                    color: 'white',
                    width: 56,
                    height: 56,
                    boxShadow: '0 4px 12px rgba(22, 51, 74, 0.3)',
                    '&:hover': {
                      backgroundColor: '#2e4a62',
                      transform: 'scale(1.05)',
                    },
                  }}
                >
                  {isPlaying ? <PauseIcon sx={{ fontSize: 32 }} /> : <PlayIcon sx={{ fontSize: 32 }} />}
                </IconButton>
              </Box>
              
              {/* Waveform Visualization */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'end', gap: 0.75, height: 96, mb: 2 }}>
                  {/* Matching mockup waveform pattern exactly - 22 bars */}
                  <Box sx={{ width: 6, height: '50%', backgroundColor: '#16334a', borderRadius: 1, opacity: 0.4 }} />
                  <Box sx={{ width: 6, height: '75%', backgroundColor: '#16334a', borderRadius: 1, opacity: 0.6 }} />
                  <Box sx={{ width: 6, height: '67%', backgroundColor: '#16334a', borderRadius: 1 }} />
                  <Box sx={{ width: 6, height: '25%', backgroundColor: '#e0c29a', borderRadius: 1 }} />
                  <Box sx={{ width: 6, height: '83%', backgroundColor: '#16334a', borderRadius: 1 }} />
                  <Box sx={{ width: 6, height: '100%', backgroundColor: '#16334a', borderRadius: 1 }} />
                  <Box sx={{ width: 6, height: '67%', backgroundColor: '#16334a', borderRadius: 1 }} />
                  <Box sx={{ width: 6, height: '50%', backgroundColor: '#e0c29a', borderRadius: 1 }} />
                  <Box sx={{ width: 6, height: '75%', backgroundColor: '#16334a', borderRadius: 1 }} />
                  <Box sx={{ width: 6, height: '50%', backgroundColor: '#16334a', borderRadius: 1, opacity: 0.8 }} />
                  <Box sx={{ width: 6, height: '33%', backgroundColor: '#16334a', borderRadius: 1, opacity: 0.6 }} />
                  <Box sx={{ width: 6, height: '50%', backgroundColor: '#16334a', borderRadius: 1 }} />
                  <Box sx={{ width: 6, height: '75%', backgroundColor: '#16334a', borderRadius: 1 }} />
                  <Box sx={{ width: 6, height: '100%', backgroundColor: '#16334a', borderRadius: 1 }} />
                  <Box sx={{ width: 6, height: '93%', backgroundColor: '#16334a', borderRadius: 1, opacity: 0.9 }} />
                  <Box sx={{ width: 6, height: '25%', backgroundColor: '#e0c29a', borderRadius: 1 }} />
                  <Box sx={{ width: 6, height: '50%', backgroundColor: '#16334a', borderRadius: 1 }} />
                  <Box sx={{ width: 6, height: '67%', backgroundColor: '#16334a', borderRadius: 1 }} />
                  <Box sx={{ width: 6, height: '75%', backgroundColor: '#16334a', borderRadius: 1, opacity: 0.7 }} />
                  <Box sx={{ width: 6, height: '50%', backgroundColor: '#16334a', borderRadius: 1, opacity: 0.5 }} />
                  <Box sx={{ width: 6, height: '25%', backgroundColor: '#e0c29a', borderRadius: 1 }} />
                  <Box sx={{ width: 6, height: '50%', backgroundColor: '#16334a', borderRadius: 1, opacity: 0.4 }} />
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', typography: 'caption', color: '#73777d', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                  <span>0:00</span>
                  <Typography variant="caption" className="serif-font" sx={{ fontStyle: 'italic', color: '#546669' }}>
                    "The story of the blue house..."
                  </Typography>
                  <span>2:45</span>
                </Box>
              </Box>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Memory Wall Section */}
      <Box sx={{ mb: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" className="serif-font">
            Memory Wall
          </Typography>
          <Button
            variant="text"
            endIcon={<ArrowForwardIcon />}
            onClick={() => router.push('/stories')}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            View All Stories
          </Button>
        </Box>

        {/* Bento Grid */}
        <Grid container spacing={3}>
          {memoryWallItems.map((item, index) => (
            <Grid
              key={item.id}
              size={{
                xs: 12,
                sm: item.type === 'audio-memory' ? 12 : 6,
                md: item.type === 'audio-memory' ? 8 : item.type === 'archive-stats' ? 4 : 6
              }}
            >
              <Card
                sx={{
                  backgroundColor: '#ffffff',
                  borderRadius: 3,
                  p: 3,
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 10px 40px rgba(28, 28, 25, 0.06)',
                  },
                }}
              >
                {item.type === 'quote' && (
                  <Box>
                    <Chip label={item.category} size="small" sx={{ mb: 2 }} />
                    <Typography variant="h6" className="serif-font" sx={{ mb: 2, fontStyle: 'italic' }}>
                      "{item.content}"
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar src={item.authorAvatarUrl} sx={{ width: 32, height: 32 }} />
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {item.author}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.authorRole}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}

                {item.type === 'audio-memory' && (
                  <Box sx={{ display: 'flex', gap: 3 }}>
                    <Box
                      sx={{
                        width: 120,
                        height: 120,
                        borderRadius: 2,
                        backgroundImage: `url(${item.imageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        {item.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {item.description}
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<PlayIcon />}
                        sx={{ textTransform: 'none' }}
                      >
                        Listen to Legacy
                      </Button>
                    </Box>
                  </Box>
                )}

                {item.type === 'short-quote' && (
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body1" sx={{ mb: 2, fontStyle: 'italic' }}>
                      {item.content}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.author} • {item.timeAgo}
                    </Typography>
                  </Box>
                )}

                {item.type === 'archive-stats' && (
                  <Box>
                    <Typography variant="h6" sx={{ mb: 3 }}>
                      The Archive Collection
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="h4" color="primary">
                          {item.stats?.stories}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Stories
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="h4" color="primary">
                          {item.stats?.documents}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Documents
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="h4" color="primary">
                          {item.stats?.recordings}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Recordings
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="h4" color="primary">
                          +{item.stats?.additional}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          More
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Preserve the Present Section */}
      <Box>
        <Typography variant="h4" className="serif-font" sx={{ mb: 1 }}>
          Preserve the Present
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Every memory matters. Start preserving today to build tomorrow's archive.
        </Typography>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card
              onClick={() => router.push('/talk')}
              sx={{
                backgroundColor: '#ffffff',
                borderRadius: 3,
                p: 3,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 10px 40px rgba(28, 28, 25, 0.06)',
                },
              }}
            >
              <ChatIcon sx={{ fontSize: 48, color: '#16334a', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                Start Conversation
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Talk with Evelyn and capture new memories
              </Typography>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card
              onClick={() => router.push('/stories')}
              sx={{
                backgroundColor: '#ffffff',
                borderRadius: 3,
                p: 3,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 10px 40px rgba(28, 28, 25, 0.06)',
                },
              }}
            >
              <EditIcon sx={{ fontSize: 48, color: '#16334a', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                New Story
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Share a memory or write a new story
              </Typography>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card
              onClick={() => router.push('/voice-lab')}
              sx={{
                backgroundColor: '#ffffff',
                borderRadius: 3,
                p: 3,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 10px 40px rgba(28, 28, 25, 0.06)',
                },
              }}
            >
              <UploadIcon sx={{ fontSize: 48, color: '#16334a', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                Upload Recording
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Add audio files or voice recordings
              </Typography>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  )
}
