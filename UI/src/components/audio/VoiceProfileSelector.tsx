
import { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Radio,
  FormControlLabel,
  FormControl,
  RadioGroup,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
} from '@mui/material'
import {
  SettingsVoice as VoiceIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material'
import { useApi } from '@/hooks/useApi'

interface VoiceProfile {
  id: string
  name: string
  description: string | null
  isDefault: boolean
  isCloned: boolean
  status: 'TRAINING' | 'READY' | 'ERROR' | 'DISABLED'
  personId: string | null
  personName: string | null
  sampleAudioUrl: string | null
  createdAt: string
}

interface VoiceProfileSelectorProps {
  personId?: string
  selectedProfileId: string | null
  onSelect: (profileId: string) => void
  onCreateNew?: () => void
  showPreview?: boolean
}

export function VoiceProfileSelector({
  personId,
  selectedProfileId,
  onSelect,
  onCreateNew,
  showPreview = true,
}: VoiceProfileSelectorProps) {
  const [previewingId, setPreviewingId] = useState<string | null>(null)

  const { data: profiles, isLoading, error } = useApi<VoiceProfile[]>({
    url: personId ? `/api/voice/profiles?personId=${personId}` : '/api/voice/profiles',
  })

  const handlePreview = (profile: VoiceProfile) => {
    if (!profile.sampleAudioUrl) return
    setPreviewingId(profile.id)
    const audio = new Audio(profile.sampleAudioUrl)
    audio.play()
    audio.onended = () => setPreviewingId(null)
    audio.onerror = () => setPreviewingId(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'READY':
        return 'success'
      case 'TRAINING':
        return 'warning'
      case 'ERROR':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'READY':
        return 'Ready'
      case 'TRAINING':
        return 'Training'
      case 'ERROR':
        return 'Error'
      case 'DISABLED':
        return 'Disabled'
      default:
        return status
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load voice profiles
      </Alert>
    )
  }

  const availableProfiles = profiles?.filter((p) => p.status === 'READY') || []

  if (availableProfiles.length === 0) {
    return (
      <Card variant="outlined" sx={{ bgcolor: 'rgba(208, 227, 230, 0.2)' }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <VoiceIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 2 }}>
            No voice profiles available
          </Typography>
          {onCreateNew && (
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={onCreateNew}
            >
              Create Voice Profile
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <FormControl fullWidth>
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Select Voice Profile
      </Typography>

      <RadioGroup
        value={selectedProfileId || ''}
        onChange={(e) => onSelect(e.target.value)}
      >
        {availableProfiles.map((profile) => (
          <Card
            key={profile.id}
            variant="outlined"
            sx={{
              mb: 2,
              cursor: 'pointer',
              transition: 'all 0.2s',
              borderColor: selectedProfileId === profile.id ? 'primary.main' : 'divider',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'rgba(22, 51, 74, 0.02)',
              },
            }}
            onClick={() => onSelect(profile.id)}
          >
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <FormControlLabel
                  value={profile.id}
                  control={<Radio />}
                  sx={{ m: 0, flexGrow: 1 }}
                  label={
                    <Box sx={{ ml: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {profile.name}
                        </Typography>
                        {profile.isDefault && (
                          <Chip
                            label="Default"
                            size="small"
                            color="primary"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                        {profile.isCloned ? (
                          <Chip
                            label="Cloned"
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        ) : (
                          <Chip
                            label="Designed"
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                      {profile.description && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          {profile.description}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <Chip
                          label={getStatusLabel(profile.status)}
                          size="small"
                          color={getStatusColor(profile.status) as any}
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Created {new Date(profile.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  }
                />

                {showPreview && profile.status === 'READY' && (
                  <Tooltip title={profile.sampleAudioUrl ? 'Preview voice' : 'Sample not yet available'}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePreview(profile)
                        }}
                        disabled={previewingId === profile.id || !profile.sampleAudioUrl}
                      >
                        {previewingId === profile.id ? (
                          <CircularProgress size={20} />
                        ) : (
                          <PlayIcon fontSize="small" />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </Box>
            </CardContent>
          </Card>
        ))}
      </RadioGroup>

      {onCreateNew && (
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onCreateNew}
          sx={{ mt: 2 }}
        >
          Create New Voice Profile
        </Button>
      )}
    </FormControl>
  )
}
