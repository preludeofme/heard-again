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
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                backgroundColor: '#ffffff',
                borderRadius: 3,
                p: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, mb: 3 }}>
                <Avatar
                  src={legacySubject.avatarUrl}
                  sx={{ width: 80, height: 80 }}
                />
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h4" className="serif-font">
                      {legacySubject.fullName}
                    </Typography>
                    <HeartIcon sx={{ color: '#e74c3c', fontSize: 24 }} />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {legacySubject.lifespanText}
                  </Typography>
                  <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
                    {legacySubject.bio}
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>

          {/* Voice Sample Card */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                backgroundColor: '#ffffff',
                borderRadius: 3,
                p: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Typography variant="h6" sx={{ mb: 1 }}>
                Voice Sample
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Generated Legacy Clone — High Fidelity
              </Typography>
              
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                <IconButton
                  onClick={() => setIsPlaying(!isPlaying)}
                  sx={{
                    backgroundColor: '#16334a',
                    color: 'white',
                    width: 80,
                    height: 80,
                    mb: 3,
                    '&:hover': {
                      backgroundColor: '#2e4a62',
                    },
                  }}
                >
                  {isPlaying ? <PauseIcon sx={{ fontSize: 40 }} /> : <PlayIcon sx={{ fontSize: 40 }} />}
                </IconButton>
                
                {/* Waveform Visualization */}
                <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="caption">0:00</Typography>
                  <Box sx={{ flex: 1, height: 40, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {[...Array(50)].map((_, i) => (
                      <Box
                        key={i}
                        sx={{
                          flex: 1,
                          height: Math.random() * 30 + 10,
                          backgroundColor: i % 5 === 0 ? '#16334a' : '#e0c29a',
                          borderRadius: 1,
                        }}
                      />
                    ))}
                  </Box>
                  <Typography variant="caption">2:45</Typography>
                </Box>
                
                <Typography variant="body2" color="text.secondary" className="serif-font" sx={{ fontStyle: 'italic' }}>
                  "The best way to remember is to share."
                </Typography>
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
