import { Box, Typography, Card, Button, Grid, Chip, Avatar } from '@mui/material'
import { 
  PlayArrowOutlined as PlayIcon, 
  FavoriteBorder as HeartIcon, 
  ArrowForwardOutlined as ArrowForwardIcon, 
  MicNoneOutlined as MicIcon, 
  EditOutlined as EditIcon, 
  CloudUploadOutlined as UploadIcon, 
  ChatOutlined as ChatIcon 
} from '@mui/icons-material'
import { LegacySubject, MemoryWallItem } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/router'
import Image from 'next/image'

interface DashboardProps {
  legacySubject: LegacySubject
  memoryWallItems: MemoryWallItem[]
}

export function Dashboard({ legacySubject, memoryWallItems }: DashboardProps) {
  const router = useRouter()
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
                  sx={{
                    width: 128,
                    height: 128,
                    border: '4px solid #f0ede8',
                    overflow: 'hidden',
                  }}
                >
                  {legacySubject.avatarUrl && (
                    <Image
                      src={legacySubject.avatarUrl}
                      alt={legacySubject.fullName}
                      width={128}
                      height={128}
                      style={{ objectFit: 'cover' }}
                    />
                  )}
                </Avatar>
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
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <MicIcon sx={{ fontSize: 48, color: '#16334a', opacity: 0.4 }} />
              <Typography variant="h5" className="serif-font" sx={{ color: '#16334a', textAlign: 'center' }}>
                Bring their stories to life
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 320 }}>
                Upload an old voicemail or record a new greeting to create a voice profile.
              </Typography>
              <Button
                variant="contained"
                startIcon={<MicIcon />}
                onClick={() => router.push('/voice-lab')}
                sx={{ mt: 1, backgroundColor: '#16334a', '&:hover': { backgroundColor: '#2e4a62' } }}
              >
                Go to Voice Profiles
              </Button>
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
        {memoryWallItems.length === 0 ? (
          <Box sx={{ textAlign: 'center', p: 8, backgroundColor: '#ffffff', borderRadius: 3, mb: 4, border: '1px dashed #d0e3e6' }}>
            <Typography variant="h6" className="serif-font" sx={{ color: '#16334a', mb: 1 }}>
              The wall is empty
            </Typography>
            <Typography variant="body2" sx={{ color: '#546669', mb: 3 }}>
              Every legacy starts with a single memory.
            </Typography>
            <Button
              variant="contained"
              onClick={() => router.push('/stories')}
              sx={{ backgroundColor: '#16334a', '&:hover': { backgroundColor: '#2e4a62' }, px: 4 }}
            >
              Tell the first story about {legacySubject.fullName.split(' ')[0]}
            </Button>
          </Box>
        ) : (
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
                  role="button"
                  aria-label={`View story: ${item.title || item.content}`}
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
                          flexShrink: 0,
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        {item.imageUrl && (
                          <Image
                            src={item.imageUrl}
                            alt={item.title ?? 'Memory thumbnail'}
                            fill
                            style={{ objectFit: 'cover' }}
                          />
                        )}
                      </Box>
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
                          onClick={() => router.push(item.storyId ? `/stories/${item.storyId}` : '/stories')}
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
        )}
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
               role="button"
               aria-label="Start AI conversation"
               onClick={() => router.push(legacySubject.id === 'global' ? '/profile' : `/chat/${legacySubject.id}`)}
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
                 Talk with {legacySubject.fullName.split(' ')[0]} and capture new memories
               </Typography>
             </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card
              role="button"
              aria-label="Create new story"
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
              role="button"
              aria-label="Upload recording"
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
