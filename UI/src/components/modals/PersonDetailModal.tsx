import React, { useCallback, useEffect, useRef, useState } from 'react'
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
  TextField,
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
  Stop as StopIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  MoreVert as MoreIcon,
  OpenInNew as OpenInNewIcon,
  PhotoCamera as PhotoCameraIcon,
  PermMedia as MediaIcon,
  AudioFile as AudioFileIcon,
  VideoFile as VideoFileIcon,
  InsertDriveFile as FileIcon,
  Download as DownloadIcon,
  Check as CheckIcon,
} from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'
import { fetchWithCSRFAndJSON, fetchWithCSRF } from '@/lib/api-client'
import { resizeImageFile } from '@/lib/resize-image'
import { ConfirmDialog } from './ConfirmDialog'

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
  sampleAudioUrl?: string | null
  createdAt: string
}

interface Relationship {
  id: string
  relatedPerson: {
    id: string
    firstName: string
    lastName?: string
    avatarUrl?: string
    sex?: 'M' | 'F' | 'U' | 'X' | null
  }
  type: string
  isMutual: boolean
}

interface MediaDocument {
  id: string
  title: string
  documentType: string
  createdAt: string
  asset: {
    id: string
    filename: string
    mimeType: string
    sizeBytes: number | null
    storagePath: string
  } | null
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
  onRelativeClick?: (personId: string) => void
  onAvatarUpdated?: () => void
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
  onRelativeClick,
  onAvatarUpdated,
}: PersonDetailModalProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [playingProfileId, setPlayingProfileId] = useState<string | null>(null)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Media tab state
  const [mediaDocs, setMediaDocs] = useState<MediaDocument[]>([])
  const [isLoadingMedia, setIsLoadingMedia] = useState(false)
  const [playingMediaId, setPlayingMediaId] = useState<string | null>(null)
  const mediaAudioRef = useRef<HTMLAudioElement | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MediaDocument | null>(null)
  const [isDeletingMedia, setIsDeletingMedia] = useState(false)
  const [isDeletePersonConfirmOpen, setIsDeletePersonConfirmOpen] = useState(false)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [editingTitleValue, setEditingTitleValue] = useState('')
  const [isSavingTitle, setIsSavingTitle] = useState(false)
  const audioUploadRef = useRef<HTMLInputElement>(null)
  const videoUploadRef = useRef<HTMLInputElement>(null)
  const docUploadRef = useRef<HTMLInputElement>(null)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)

  const handleAvatarUpload = async (file: File) => {
    if (!person) return
    setIsUploadingAvatar(true)
    try {
      const resized = await resizeImageFile(file)
      const form = new FormData()
      form.append('file', resized)
      const res = await fetchWithCSRF(`/api/people/${person.id}/avatar`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) throw new Error('Upload failed')
      onAvatarUpdated?.()
    } catch {
      // silently fail
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const fetchMediaDocs = useCallback(async () => {
    if (!person) return
    setIsLoadingMedia(true)
    try {
      const res = await fetch(`/api/documents?personId=${person.id}&limit=100`)
      if (!res.ok) throw new Error('Failed to load media')
      const json = await res.json()
      setMediaDocs((json.data as MediaDocument[]) ?? [])
    } catch {
      // silently fail — empty state will show
    } finally {
      setIsLoadingMedia(false)
    }
  }, [person])

  useEffect(() => {
    if (activeTab === 3 && person) {
      void fetchMediaDocs()
    }
  }, [activeTab, person, fetchMediaDocs])

  const handleMediaUpload = async (file: File, docType: string) => {
    if (!person) return
    setIsUploadingMedia(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('personId', person.id)
      const uploadRes = await fetchWithCSRF('/api/assets/upload', {
        method: 'POST',
        body: formData,
      })
      if (!uploadRes.ok) throw new Error('Upload failed')
      const uploadJson = await uploadRes.json()
      const assetId: string = uploadJson.data?.id ?? uploadJson.id
      const title = file.name.replace(/\.[^/.]+$/, '')
      const docRes = await fetchWithCSRFAndJSON('/api/documents', {
        assetId,
        title,
        documentType: docType,
        people: [{ personId: person.id }],
      })
      if (!docRes.ok) throw new Error('Document creation failed')
      await fetchMediaDocs()
    } catch {
      // silently fail
    } finally {
      setIsUploadingMedia(false)
    }
  }

  const handlePlayMedia = (doc: MediaDocument) => {
    if (playingMediaId === doc.id) {
      mediaAudioRef.current?.pause()
      mediaAudioRef.current = null
      setPlayingMediaId(null)
      return
    }
    if (!doc.asset) return
    const url = `/api/assets/serve/${doc.asset.id}`
    const audio = new Audio(url)
    mediaAudioRef.current = audio
    audio.onended = () => {
      setPlayingMediaId(null)
      mediaAudioRef.current = null
    }
    setPlayingMediaId(doc.id)
    void audio.play()
  }

  const handleDeleteMedia = async () => {
    if (!deleteTarget) return
    setIsDeletingMedia(true)
    try {
      const res = await fetchWithCSRF(`/api/documents/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setMediaDocs((prev) => prev.filter((d) => d.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      // silently fail
    } finally {
      setIsDeletingMedia(false)
    }
  }

  const startEditTitle = (doc: MediaDocument) => {
    setEditingTitleId(doc.id)
    setEditingTitleValue(doc.title)
  }

  const saveEditTitle = async (docId: string) => {
    const trimmed = editingTitleValue.trim()
    if (!trimmed) return
    setIsSavingTitle(true)
    try {
      const res = await fetchWithCSRFAndJSON(`/api/documents/${docId}`, { title: trimmed }, { method: 'PUT' })
      if (!res.ok) throw new Error('Update failed')
      setMediaDocs((prev) => prev.map((d) => d.id === docId ? { ...d, title: trimmed } : d))
    } catch {
      // silently fail
    } finally {
      setIsSavingTitle(false)
      setEditingTitleId(null)
    }
  }

  const audioDocs = mediaDocs.filter((d) => d.documentType === 'AUDIO' || d.documentType === 'RECORDING')
  const videoDocs = mediaDocs.filter((d) => d.documentType === 'VIDEO')
  const otherDocs = mediaDocs.filter((d) => !['AUDIO', 'RECORDING', 'VIDEO'].includes(d.documentType))

  const handlePlayVoice = async (profile: VoiceProfile) => {
    if (playingProfileId === profile.id) {
      audioRef.current?.pause()
      audioRef.current = null
      setPlayingProfileId(null)
      return
    }

    let audioUrl: string | null = profile.sampleAudioUrl ?? null

    if (!audioUrl) {
      setIsSynthesizing(true)
      try {
        const firstName = person?.firstName ?? 'the family'
        const response = await fetchWithCSRFAndJSON('/api/voice/synthesize', {
          modelId: profile.id,
          text: `Hello, this is a sample of my digital voice clone for ${firstName}.`,
        })
        if (!response.ok) throw new Error('Synthesis failed')
        const result = await response.json()
        audioUrl = result.data?.audioUrl || result.audioUrl || null
      } catch {
        setIsSynthesizing(false)
        return
      } finally {
        setIsSynthesizing(false)
      }
    }

    if (!audioUrl) return

    const audio = new Audio(audioUrl)
    audioRef.current = audio
    audio.onended = () => {
      setPlayingProfileId(null)
      audioRef.current = null
    }
    setPlayingProfileId(profile.id)
    audio.play()
  }

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

  const getRelationshipLabel = (rel: Relationship) => {
    const { type, relatedPerson } = rel
    const sex = relatedPerson.sex

    if (type === 'PARENT') {
      if (sex === 'M') return 'Father'
      if (sex === 'F') return 'Mother'
      return 'Parent'
    }
    if (type === 'CHILD') {
      if (sex === 'M') return 'Son'
      if (sex === 'F') return 'Daughter'
      return 'Child'
    }
    if (type === 'SPOUSE') {
      if (sex === 'M') return 'Husband'
      if (sex === 'F') return 'Wife'
      return 'Spouse'
    }
    if (type === 'SIBLING') {
      if (sex === 'M') return 'Brother'
      if (sex === 'F') return 'Sister'
      return 'Sibling'
    }

    const labels: Record<string, string> = {
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
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleAvatarUpload(file)
                  e.target.value = ''
                }}
              />
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
              <Tooltip title="Change photo">
                <IconButton
                  size="small"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  sx={{
                    position: 'absolute',
                    bottom: -4,
                    right: -4,
                    bgcolor: 'rgba(255,255,255,0.9)',
                    '&:hover': { bgcolor: '#fff' },
                    width: 28,
                    height: 28,
                  }}
                  aria-label="Change profile photo"
                >
                  {isUploadingAvatar ? (
                    <CircularProgress size={14} sx={{ color: '#16334a' }} />
                  ) : (
                    <PhotoCameraIcon sx={{ fontSize: 14, color: '#16334a' }} />
                  )}
                </IconButton>
              </Tooltip>
            </Box>

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
            <Tab
              label={`Media (${mediaDocs.length})`}
              icon={<MediaIcon sx={{ fontSize: 18 }} />}
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
                            onClick={() => handlePlayVoice(profile)}
                            disabled={isSynthesizing && playingProfileId !== profile.id}
                            aria-label={playingProfileId === profile.id ? 'Stop voice sample' : `Play voice sample for ${profile.name}`}
                            sx={{ color: '#546669' }}
                          >
                            {isSynthesizing && playingProfileId !== profile.id ? (
                              <CircularProgress size={20} sx={{ color: '#546669' }} />
                            ) : playingProfileId === profile.id ? (
                              <StopIcon />
                            ) : (
                              <PlayIcon />
                            )}
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

          {/* Media Tab */}
          {activeTab === 3 && (
            <Box>
              {/* Hidden file inputs */}
              <input ref={audioUploadRef} type="file" accept="audio/*" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleMediaUpload(f, 'AUDIO'); e.target.value = '' }} />
              <input ref={videoUploadRef} type="file" accept="video/*" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleMediaUpload(f, 'VIDEO'); e.target.value = '' }} />
              <input ref={docUploadRef} type="file" accept=".pdf,.doc,.docx,.txt,image/*" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleMediaUpload(f, f.type.startsWith('image/') ? 'PHOTO' : 'PDF'); e.target.value = '' }} />

              {isLoadingMedia ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  {/* Audio Section */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AudioFileIcon sx={{ fontSize: 18, color: '#546669' }} />
                        <Typography variant="subtitle2" sx={{ color: '#16334a', fontWeight: 600 }}>Audio</Typography>
                      </Box>
                      <Button size="small" startIcon={isUploadingMedia ? <CircularProgress size={12} /> : <AddIcon />}
                        disabled={isUploadingMedia}
                        onClick={() => audioUploadRef.current?.click()}
                        sx={{ textTransform: 'none', color: '#16334a', fontSize: '0.75rem' }}>
                        Upload
                      </Button>
                    </Box>
                    {audioDocs.length === 0 ? (
                      <Typography variant="body2" sx={{ color: '#aaa', pl: 1 }}>No audio files yet.</Typography>
                    ) : (
                      <List dense sx={{ p: 0 }}>
                        {audioDocs.map((doc) => (
                          <ListItem key={doc.id} disableGutters sx={{ gap: 1, py: 0.5 }}>
                            <IconButton size="small" aria-label={playingMediaId === doc.id ? 'Stop audio' : `Play ${doc.title}`}
                              onClick={() => handlePlayMedia(doc)} sx={{ color: '#16334a' }}>
                              {playingMediaId === doc.id ? <StopIcon fontSize="small" /> : <PlayIcon fontSize="small" />}
                            </IconButton>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              {editingTitleId === doc.id ? (
                                <TextField size="small" value={editingTitleValue} autoFocus
                                  onChange={(e) => setEditingTitleValue(e.target.value)}
                                  onBlur={() => void saveEditTitle(doc.id)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') void saveEditTitle(doc.id); if (e.key === 'Escape') setEditingTitleId(null) }}
                                  InputProps={{ endAdornment: isSavingTitle ? <CircularProgress size={12} /> : <CheckIcon sx={{ fontSize: 14, color: '#1a6b5a', cursor: 'pointer' }} onClick={() => void saveEditTitle(doc.id)} /> }}
                                  sx={{ width: '100%' }} />
                              ) : (
                                <Typography variant="body2" noWrap sx={{ color: '#333' }}>{doc.title}</Typography>
                              )}
                            </Box>
                            <Tooltip title="Edit title">
                              <IconButton size="small" aria-label={`Edit title for ${doc.title}`} onClick={() => startEditTitle(doc)} sx={{ color: '#546669' }}>
                                <EditIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                            {doc.asset && (
                              <Tooltip title="Download">
                                <IconButton size="small" component="a" href={`/api/assets/serve/${doc.asset.id}`} download={doc.asset.filename}
                                  aria-label={`Download ${doc.title}`} sx={{ color: '#546669' }}>
                                  <DownloadIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Delete">
                              <IconButton size="small" aria-label={`Delete ${doc.title}`} onClick={() => setDeleteTarget(doc)} sx={{ color: '#c62828' }}>
                                <DeleteIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {/* Video Section */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <VideoFileIcon sx={{ fontSize: 18, color: '#546669' }} />
                        <Typography variant="subtitle2" sx={{ color: '#16334a', fontWeight: 600 }}>Video</Typography>
                      </Box>
                      <Button size="small" startIcon={isUploadingMedia ? <CircularProgress size={12} /> : <AddIcon />}
                        disabled={isUploadingMedia}
                        onClick={() => videoUploadRef.current?.click()}
                        sx={{ textTransform: 'none', color: '#16334a', fontSize: '0.75rem' }}>
                        Upload
                      </Button>
                    </Box>
                    {videoDocs.length === 0 ? (
                      <Typography variant="body2" sx={{ color: '#aaa', pl: 1 }}>No video files yet.</Typography>
                    ) : (
                      <List dense sx={{ p: 0 }}>
                        {videoDocs.map((doc) => (
                          <ListItem key={doc.id} disableGutters sx={{ gap: 1, py: 0.5 }}>
                            <VideoFileIcon sx={{ fontSize: 20, color: '#546669', ml: 0.5, mr: 0.5 }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              {editingTitleId === doc.id ? (
                                <TextField size="small" value={editingTitleValue} autoFocus
                                  onChange={(e) => setEditingTitleValue(e.target.value)}
                                  onBlur={() => void saveEditTitle(doc.id)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') void saveEditTitle(doc.id); if (e.key === 'Escape') setEditingTitleId(null) }}
                                  InputProps={{ endAdornment: isSavingTitle ? <CircularProgress size={12} /> : <CheckIcon sx={{ fontSize: 14, color: '#1a6b5a', cursor: 'pointer' }} onClick={() => void saveEditTitle(doc.id)} /> }}
                                  sx={{ width: '100%' }} />
                              ) : (
                                <Typography variant="body2" noWrap sx={{ color: '#333' }}>{doc.title}</Typography>
                              )}
                            </Box>
                            <Tooltip title="Edit title">
                              <IconButton size="small" aria-label={`Edit title for ${doc.title}`} onClick={() => startEditTitle(doc)} sx={{ color: '#546669' }}>
                                <EditIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                            {doc.asset && (
                              <Tooltip title="Download">
                                <IconButton size="small" component="a" href={`/api/assets/serve/${doc.asset.id}`} download={doc.asset.filename}
                                  aria-label={`Download ${doc.title}`} sx={{ color: '#546669' }}>
                                  <DownloadIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Delete">
                              <IconButton size="small" aria-label={`Delete ${doc.title}`} onClick={() => setDeleteTarget(doc)} sx={{ color: '#c62828' }}>
                                <DeleteIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {/* Documents Section */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FileIcon sx={{ fontSize: 18, color: '#546669' }} />
                        <Typography variant="subtitle2" sx={{ color: '#16334a', fontWeight: 600 }}>Documents &amp; Photos</Typography>
                      </Box>
                      <Button size="small" startIcon={isUploadingMedia ? <CircularProgress size={12} /> : <AddIcon />}
                        disabled={isUploadingMedia}
                        onClick={() => docUploadRef.current?.click()}
                        sx={{ textTransform: 'none', color: '#16334a', fontSize: '0.75rem' }}>
                        Upload
                      </Button>
                    </Box>
                    {otherDocs.length === 0 ? (
                      <Typography variant="body2" sx={{ color: '#aaa', pl: 1 }}>No documents or photos yet.</Typography>
                    ) : (
                      <List dense sx={{ p: 0 }}>
                        {otherDocs.map((doc) => (
                          <ListItem key={doc.id} disableGutters sx={{ gap: 1, py: 0.5 }}>
                            <FileIcon sx={{ fontSize: 20, color: '#546669', ml: 0.5, mr: 0.5 }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              {editingTitleId === doc.id ? (
                                <TextField size="small" value={editingTitleValue} autoFocus
                                  onChange={(e) => setEditingTitleValue(e.target.value)}
                                  onBlur={() => void saveEditTitle(doc.id)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') void saveEditTitle(doc.id); if (e.key === 'Escape') setEditingTitleId(null) }}
                                  InputProps={{ endAdornment: isSavingTitle ? <CircularProgress size={12} /> : <CheckIcon sx={{ fontSize: 14, color: '#1a6b5a', cursor: 'pointer' }} onClick={() => void saveEditTitle(doc.id)} /> }}
                                  sx={{ width: '100%' }} />
                              ) : (
                                <Typography variant="body2" noWrap sx={{ color: '#333' }}>{doc.title}</Typography>
                              )}
                              <Typography variant="caption" sx={{ color: '#aaa' }}>
                                {doc.documentType.toLowerCase().replace('_', ' ')}
                              </Typography>
                            </Box>
                            <Tooltip title="Edit title">
                              <IconButton size="small" aria-label={`Edit title for ${doc.title}`} onClick={() => startEditTitle(doc)} sx={{ color: '#546669' }}>
                                <EditIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                            {doc.asset && (
                              <Tooltip title="Download">
                                <IconButton size="small" component="a" href={`/api/assets/serve/${doc.asset.id}`} download={doc.asset.filename}
                                  aria-label={`Download ${doc.title}`} sx={{ color: '#546669' }}>
                                  <DownloadIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Delete">
                              <IconButton size="small" aria-label={`Delete ${doc.title}`} onClick={() => setDeleteTarget(doc)} sx={{ color: '#c62828' }}>
                                <DeleteIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Box>
                </>
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
                        onClick={() => onRelativeClick?.(rel.relatedPerson.id)}
                        role="button"
                        aria-label={`View ${rel.relatedPerson.firstName}'s profile`}
                        sx={{
                          p: 3,
                          borderRadius: 3,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          transition: 'all 0.2s',
                          cursor: onRelativeClick ? 'pointer' : 'default',
                          '&:hover': onRelativeClick ? { boxShadow: '0 4px 20px rgba(0,0,0,0.08)' } : {},
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
                          <Typography variant="body2" sx={{ color: 'secondary.main', fontWeight: 500 }}>
                            {getRelationshipLabel(rel)}
                          </Typography>
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

      {/* Media delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Media"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="error"
        isLoading={isDeletingMedia}
        onConfirm={() => void handleDeleteMedia()}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Person delete confirmation */}
      <ConfirmDialog
        open={isDeletePersonConfirmOpen}
        title="Delete Family Member?"
        message={`Are you sure you want to delete ${person?.displayName ?? [person?.firstName, person?.lastName].filter(Boolean).join(' ') ?? 'this person'}? This cannot be undone.`}
        confirmLabel="Delete Permanently"
        confirmColor="error"
        onConfirm={() => {
          if (person?.id) onDelete?.(person.id)
          setIsDeletePersonConfirmOpen(false)
        }}
        onCancel={() => setIsDeletePersonConfirmOpen(false)}
      />

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
            onClick={() => person && person.id && setIsDeletePersonConfirmOpen(true)}
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
