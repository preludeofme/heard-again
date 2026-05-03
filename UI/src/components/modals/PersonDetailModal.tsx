import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Button,
  Divider,
  Grid,
  Card,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Tooltip,
  CircularProgress,
} from '@mui/material'
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AutoStories as StoriesIcon,
  RecordVoiceOver as VoiceIcon,
  People as PeopleIcon,
  Add as AddIcon,
  Favorite as FavoriteIcon,
  PlayArrow as PlayIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  MoreVert as MoreIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'

interface Person {
  id: string
  firstName: string
  lastName?: string
  displayName?: string
  birthDate?: string
  deathDate?: string
  bio?: string
  avatarUrl?: string
  personType: 'PRIMARY' | 'ANCESTOR' | 'DESCENDANT' | 'RELATED'
  role?: string
  storyCount: number
  voiceProfileCount: number
  relationshipCount: number
  createdAt: string
  updatedAt: string
}

interface Story {
  id: string
  title: string
  excerpt?: string
  content?: string
  storyType: string
  status: string
  createdAt: string
  createdBy?: { id: string; displayName?: string; email: string }
  isFavorited?: boolean
}

interface VoiceProfile {
  id: string
  name: string
  description?: string
  isDefault: boolean
  audioSampleCount: number
  createdAt: string
}

interface Relationship {
  id: string
  relatedPerson: {
    id: string
    firstName: string
    lastName?: string
    avatarUrl?: string
  }
  relationshipType: string
  isMutual: boolean
}

interface PersonDetailModalProps {
  open: boolean
  onClose: () => void
  person?: Person | null
  stories?: Story[]
  voiceProfiles?: VoiceProfile[]
  relationships?: Relationship[]
  isLoading?: boolean
  error?: string | null
  onEdit?: (person: Person) => void
  onDelete?: (personId: string) => void
  onAddStory?: (personId: string) => void
  onAddVoiceProfile?: (personId: string) => void
  onAddRelationship?: (personId: string) => void
  onStoryClick?: (storyId: string) => void
  onViewFullProfile?: (personId: string) => void
}

export function PersonDetailModal({
  open,
  onClose,
  person,
  stories = [],
  voiceProfiles = [],
  relationships = [],
  isLoading,
  error,
  onEdit,
  onDelete,
  onAddStory,
  onAddVoiceProfile,
  onAddRelationship,
  onStoryClick,
  onViewFullProfile,
}: PersonDetailModalProps) {
  const [activeTab, setActiveTab] = useState(0)

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  const getLifespanText = () => {
    if (!person?.birthDate) return 'Living'
    const birthYear = new Date(person.birthDate).getFullYear()
    if (person?.deathDate) {
      const deathYear = new Date(person.deathDate).getFullYear()
      return `${birthYear} — ${deathYear}`
    }
    return `Born ${birthYear}`
  }

  const getRelationshipLabel = (type: string) => {
    const labels: Record<string, string> = {
      SPOUSE: 'Spouse',
      CHILD: 'Child',
      PARENT: 'Parent',
      SIBLING: 'Sibling',
      GRANDPARENT: 'Grandparent',
      GRANDCHILD: 'Grandchild',
      AUNT_UNCLE: 'Aunt/Uncle',
      NIECE_NEPHEW: 'Niece/Nephew',
      COUSIN: 'Cousin',
      FRIEND: 'Friend',
      OTHER: 'Other',
    }
    return labels[type] || type
  }

  const fullName = `${person?.firstName || ''} ${person?.lastName || ''}`.trim()
  const displayName = person?.displayName || fullName

  // Show loading state while person data is being fetched
  if (isLoading) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            maxHeight: '90vh',
            overflow: 'hidden',
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 8 }}>
          <CircularProgress />
        </Box>
      </Dialog>
    )
  }

  // Show error state if API call failed
  if (error && !person) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            maxHeight: '90vh',
            overflow: 'hidden',
          },
        }}
      >
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="error" gutterBottom>
            Error Loading Person Details
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {error}
          </Typography>
          <Button onClick={onClose} sx={{ mt: 2 }}>
            Close
          </Button>
        </Box>
      </Dialog>
    )
  }

  // Show empty state if person is null (shouldn't happen with proper error handling)
  if (!person) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            maxHeight: '90vh',
            overflow: 'hidden',
          },
        }}
      >
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Person Not Found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The requested person could not be loaded.
          </Typography>
          <Button onClick={onClose} sx={{ mt: 2 }}>
            Close
          </Button>
        </Box>
      </Dialog>
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="person-detail-dialog-title"
      PaperProps={{
        sx: {
          borderRadius: 4,
          maxHeight: '90vh',
          overflow: 'hidden',
        },
      }}
    >
      {/* Header */}
      <DialogTitle id="person-detail-dialog-title" sx={{ p: 0 }}>
        <Box
          sx={{
            background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
            color: 'white',
            p: 4,
            position: 'relative',
          }}
        >
          <IconButton
            onClick={onClose}
            aria-label="Close dialog"
            sx={{
              position: 'absolute',
              right: 16,
              top: 16,
              color: 'white',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CloseIcon />
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, pr: 5 }}>
            <Avatar
              src={person?.avatarUrl}
              sx={{
                width: 100,
                height: 100,
                border: '4px solid rgba(255,255,255,0.3)',
                fontSize: '2.5rem',
                backgroundColor: 'rgba(255,255,255,0.2)',
              }}
            >
              {person?.firstName?.[0]}{person?.lastName?.[0]}
            </Avatar>

            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography
                    variant="h4"
                    sx={{
                      fontFamily: 'var(--font-newsreader), serif',
                      fontWeight: 600,
                      mb: 0.5,
                    }}
                  >
                    {displayName}
                  </Typography>

                  <Typography variant="body1" sx={{ opacity: 0.8, mb: 1 }}>
                    {getLifespanText()}
                  </Typography>
                </Box>
                
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<OpenInNewIcon />}
                  onClick={() => person && person.id && onViewFullProfile?.(person.id)}
                  sx={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(4px)',
                    color: 'white',
                    textTransform: 'none',
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.1)',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' },
                    display: { xs: 'none', sm: 'flex' }
                  }}
                >
                  Full Profile
                </Button>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {person?.role && (
                  <Chip
                    label={person.role}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      fontWeight: 500,
                    }}
                  />
                )}
                <Chip
                  label={person?.personType?.toLowerCase().replace('_', ' ')}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    fontWeight: 500,
                    textTransform: 'capitalize',
                  }}
                />
              </Box>
            </Box>
          </Box>

        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
        {/* Bio Section */}
        {person?.bio && (
          <Box sx={{ px: 4, py: 3, backgroundColor: '#f6f3ee' }}>
            <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.7, fontStyle: 'italic' }}>
              &ldquo;{person.bio}&rdquo;
            </Typography>
          </Box>
        )}

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                color: '#546669',
                '&.Mui-selected': { color: '#16334a', fontWeight: 600 },
              },
              '& .MuiTabs-indicator': { backgroundColor: '#16334a' },
            }}
          >
            <Tab
              label={`Stories (${stories?.length || 0})`}
              icon={<StoriesIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
            />
            <Tab
              label={`Voices (${voiceProfiles?.length || 0})`}
              icon={<VoiceIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
            />
            <Tab
              label={`Relatives (${relationships?.length || 0})`}
              icon={<PeopleIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
            />
          </Tabs>
        </Box>

        {/* Tab Content */}
        <Box sx={{ p: 3, maxHeight: 400, overflow: 'auto' }}>
          {/* Stories Tab */}
          {activeTab === 0 && (
            <Box>
              {stories?.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <StoriesIcon sx={{ fontSize: 48, color: '#d0e3e6', mb: 2 }} />
                  <Typography variant="h6" sx={{ color: '#546669', mb: 1 }}>
                    No stories yet
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#999', mb: 3 }}>
                    Start documenting memories about this person.
                  </Typography>
                </Box>
              ) : (
                <Grid container spacing={2}>
                  {stories.map((story) => (
                    <Grid key={story.id} size={12}>
                      <Card
                        onClick={() => onStoryClick?.(story.id)}
                        role="button"
                        aria-label={`View story: ${story.title}`}
                        sx={{
                          p: 3,
                          borderRadius: 3,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          border: '1px solid',
                          borderColor: 'rgba(208, 227, 230, 0.5)',
                          '&:hover': {
                            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                            borderColor: '#d0e3e6',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Chip
                            label={story.storyType}
                            size="small"
                            sx={{
                              backgroundColor: '#f6f3ee',
                              color: '#546669',
                              fontSize: '0.7rem',
                              textTransform: 'capitalize',
                            }}
                          />
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {story.isFavorited && (
                              <FavoriteIcon sx={{ fontSize: 16, color: '#e53935' }} />
                            )}
                            <Typography variant="caption" sx={{ color: '#999' }}>
                              {formatDistanceToNow(new Date(story.createdAt), { addSuffix: true })}
                            </Typography>
                          </Box>
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
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {story.excerpt}
                          </Typography>
                        )}

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: '#d0e3e6' }}>
                              {(story.createdBy?.displayName || story.createdBy?.email || '?')[0].toUpperCase()}
                            </Avatar>
                            <Typography variant="caption" sx={{ color: '#666' }}>
                              {story.createdBy?.displayName || story.createdBy?.email?.split('@')[0] || 'Unknown'}
                            </Typography>
                          </Box>
                          <Chip
                            label={story.status.toLowerCase()}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              backgroundColor: story.status === 'PUBLISHED' ? '#e8f5e9' : '#fff3e0',
                              color: story.status === 'PUBLISHED' ? '#2e7d32' : '#e65100',
                            }}
                          />
                        </Box>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}

          {/* Voice Profiles Tab */}
          {activeTab === 1 && (
            <Box>
              {voiceProfiles?.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <VoiceIcon sx={{ fontSize: 48, color: '#d0e3e6', mb: 2 }} />
                  <Typography variant="h6" sx={{ color: '#546669', mb: 1 }}>
                    No voice profiles yet
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#999', mb: 3 }}>
                    Create a voice profile to preserve their voice and generate new stories.
                  </Typography>
                </Box>
              ) : (
                <List sx={{ p: 0 }}>
                  {voiceProfiles.map((profile) => (
                    <ListItem
                      key={profile.id}
                      sx={{
                        mb: 2,
                        p: 0,
                        backgroundColor: '#fafafa',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      <Box sx={{ width: '100%', p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: '50%',
                              backgroundColor: profile.isDefault ? '#16334a' : '#d0e3e6',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <VoiceIcon sx={{ color: profile.isDefault ? 'white' : '#16334a' }} />
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600 }}>
                                {profile.name}
                              </Typography>
                              {profile.isDefault && (
                                <Chip
                                  label="Default"
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: '0.6rem',
                                    backgroundColor: '#16334a',
                                    color: 'white',
                                  }}
                                />
                              )}
                            </Box>
                            {profile.description && (
                              <Typography variant="body2" sx={{ color: '#666' }}>
                                {profile.description}
                              </Typography>
                            )}
                          </Box>
                          <IconButton 
                            aria-label={`Play voice sample for ${profile.name}`}
                            sx={{ color: '#546669' }}
                          >
                            <PlayIcon />
                          </IconButton>
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: '#999' }}>
                            {profile.audioSampleCount} audio samples
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#999' }}>
                            Created {formatDistanceToNow(new Date(profile.createdAt), { addSuffix: true })}
                          </Typography>
                        </Box>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}

          {/* Relationships Tab */}
          {activeTab === 2 && (
            <Box>
              {relationships?.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <PeopleIcon sx={{ fontSize: 48, color: '#d0e3e6', mb: 2 }} />
                  <Typography variant="h6" sx={{ color: '#546669', mb: 1 }}>
                    No relationships yet
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#999', mb: 3 }}>
                    Connect this person to family members on the tree.
                  </Typography>
                </Box>
              ) : (
                <Grid container spacing={2}>
                  {relationships.map((rel) => (
                    <Grid key={rel.id} size={{ xs: 12, sm: 6 }}>
                      <Card
                        sx={{
                          p: 3,
                          borderRadius: 3,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          transition: 'all 0.2s',
                          cursor: 'pointer',
                          '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
                        }}
                      >
                        <Avatar
                          src={rel.relatedPerson.avatarUrl}
                          sx={{
                            width: 56,
                            height: 56,
                            backgroundColor: '#d0e3e6',
                          }}
                        >
                          {rel.relatedPerson.firstName[0]}{rel.relatedPerson.lastName?.[0]}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600 }}>
                            {rel.relatedPerson.firstName} {rel.relatedPerson.lastName || ''}
                          </Typography>
                          <Chip
                            label={getRelationshipLabel(rel.relationshipType)}
                            size="small"
                            sx={{
                              backgroundColor: '#f6f3ee',
                              color: '#546669',
                              fontSize: '0.7rem',
                              mt: 0.5,
                            }}
                          />
                        </Box>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>

      {/* Actions */}
      <Box sx={{ p: 3, backgroundColor: '#f6f3ee', display: 'flex', gap: 2, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => onEdit?.(person!)}
            sx={{
              borderColor: '#16334a',
              color: '#16334a',
              textTransform: 'none',
              borderRadius: 2,
            }}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => person && person.id && onDelete?.(person.id)}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
            }}
          >
            Delete
          </Button>
          <Button
            variant="contained"
            startIcon={<OpenInNewIcon />}
            onClick={() => person && person.id && onViewFullProfile?.(person.id)}
            sx={{
              backgroundColor: '#1a6b5a',
              textTransform: 'none',
              borderRadius: 2,
              '&:hover': { backgroundColor: '#145a4b' },
            }}
          >
            View Full Profile
          </Button>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {activeTab === 0 && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => person && person.id && onAddStory?.(person.id)}
              sx={{
                backgroundColor: '#16334a',
                textTransform: 'none',
                borderRadius: 2,
                '&:hover': { backgroundColor: '#2e4a62' },
              }}
            >
              Add Story
            </Button>
          )}
          {activeTab === 1 && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => person && person.id && onAddVoiceProfile?.(person.id)}
              sx={{
                backgroundColor: '#16334a',
                textTransform: 'none',
                borderRadius: 2,
                '&:hover': { backgroundColor: '#2e4a62' },
              }}
            >
              Add Voice
            </Button>
          )}
          {activeTab === 2 && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => person && person.id && onAddRelationship?.(person.id)}
              sx={{
                backgroundColor: '#16334a',
                textTransform: 'none',
                borderRadius: 2,
                '&:hover': { backgroundColor: '#2e4a62' },
              }}
            >
              Add Relative
            </Button>
          )}
        </Box>
      </Box>
    </Dialog>
  )
}
