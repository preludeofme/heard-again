'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Box,
  IconButton,
  Typography,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
  Tooltip,
  Alert,
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Replay as ReplayIcon,
  Download as DownloadIcon,
  SmartToy as AiIcon,
  Save as SaveIcon,
} from '@mui/icons-material'
import { fetchWithCSRF } from '@/lib/api-client'

interface VoiceProfileOption {
  id: string
  name: string
  personId?: string | null
  personName?: string | null
}

interface SavedNarration {
  assetId: string
  downloadUrl: string
}

interface StoryNarrationPlayerProps {
  storyId: string
  title?: string
  narrationSource: 'approved' | 'original'
  voiceProfiles: VoiceProfileOption[]
  defaultVoiceProfileId?: string | null
  savedNarration?: SavedNarration | null
  canSave?: boolean
  onSaved?: (narration: SavedNarration) => void
}

export function StoryNarrationPlayer({
  storyId,
  title,
  narrationSource,
  voiceProfiles,
  defaultVoiceProfileId,
  savedNarration,
  canSave = false,
  onSaved,
}: StoryNarrationPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    defaultVoiceProfileId || voiceProfiles[0]?.id || ''
  )
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!defaultVoiceProfileId && voiceProfiles.length > 0 && !selectedProfileId) {
      setSelectedProfileId(voiceProfiles[0].id)
    }
  }, [defaultVoiceProfileId, voiceProfiles, selectedProfileId])

  const streamUrl = selectedProfileId
    ? `/api/stories/${storyId}/narrate?voiceProfileId=${encodeURIComponent(selectedProfileId)}&_t=${Date.now()}`
    : null

  const handlePlay = () => {
    if (!streamUrl) {
      setError('Select a voice first.')
      return
    }
    setError(null)
    setIsLoading(true)
    // Tear down any previous element so the browser restarts the stream.
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    const audio = new Audio(streamUrl)
    audio.preload = 'auto'
    audio.addEventListener('playing', () => {
      setIsLoading(false)
      setIsPlaying(true)
    })
    audio.addEventListener('waiting', () => setIsLoading(true))
    audio.addEventListener('ended', () => {
      setIsPlaying(false)
      setIsLoading(false)
    })
    audio.addEventListener('error', () => {
      setIsLoading(false)
      setIsPlaying(false)
      setError('Narration failed to play.')
    })
    audioRef.current = audio
    audio.play().catch(() => {
      setIsLoading(false)
      setError('Unable to start playback.')
    })
  }

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    setIsPlaying(false)
    setIsLoading(false)
  }

  const handleSave = async () => {
    if (!selectedProfileId) return
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetchWithCSRF(`/api/stories/${storyId}/save-narration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ voiceProfileId: selectedProfileId }),
      })
      const payload = await res.json()
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to save narration')
      }
      const saved: SavedNarration = {
        assetId: payload.data.outputAssetId,
        downloadUrl: payload.data.outputAssetDownloadUrl,
      }
      onSaved?.(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
    }
  }, [])

  return (
    <Box
      sx={{
        backgroundColor: '#f6f3ee',
        border: '1px solid #ebe8e3',
        borderRadius: 3,
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#16334a' }}>
          {title ? `Listen to "${title}"` : 'Listen'}
        </Typography>
        <Chip
          icon={<AiIcon sx={{ fontSize: 14 }} />}
          label={`AI-generated (${narrationSource})`}
          size="small"
          sx={{ backgroundColor: '#d0e3e6', color: '#16334a', fontWeight: 500 }}
        />
      </Box>

      <FormControl size="small" sx={{ maxWidth: 360 }}>
        <InputLabel id="voice-profile-select-label">Voice</InputLabel>
        <Select
          labelId="voice-profile-select-label"
          label="Voice"
          value={selectedProfileId}
          onChange={(e) => setSelectedProfileId(e.target.value as string)}
          disabled={voiceProfiles.length === 0 || isPlaying || isLoading}
        >
          {voiceProfiles.length === 0 ? (
            <MenuItem value="" disabled>No ready voice profiles</MenuItem>
          ) : (
            voiceProfiles.map((vp) => (
              <MenuItem key={vp.id} value={vp.id}>
                {vp.personName ? `${vp.personName} — ${vp.name}` : vp.name}
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        {!isPlaying ? (
          <Tooltip title="Play narration">
            <span>
              <IconButton
                onClick={handlePlay}
                disabled={!selectedProfileId || isLoading}
                sx={{
                  backgroundColor: '#16334a',
                  color: 'white',
                  '&:hover': { backgroundColor: '#2e4a62' },
                  '&.Mui-disabled': { backgroundColor: '#ccc', color: '#fff' },
                }}
              >
                {isLoading ? (
                  <CircularProgress size={22} sx={{ color: 'white' }} />
                ) : (
                  <PlayIcon />
                )}
              </IconButton>
            </span>
          </Tooltip>
        ) : (
          <Tooltip title="Stop">
            <IconButton
              onClick={handleStop}
              sx={{ backgroundColor: '#c62828', color: 'white', '&:hover': { backgroundColor: '#e53935' } }}
            >
              <StopIcon />
            </IconButton>
          </Tooltip>
        )}

        {isPlaying && (
          <Typography variant="caption" sx={{ color: '#546669' }}>
            Streaming — forward-only playback
          </Typography>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {savedNarration ? (
          <Button
            component="a"
            href={savedNarration.downloadUrl}
            startIcon={<DownloadIcon />}
            variant="text"
            sx={{ textTransform: 'none', color: '#16334a', fontWeight: 600 }}
          >
            Download
          </Button>
        ) : canSave ? (
          <Button
            onClick={handleSave}
            startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
            variant="text"
            disabled={!selectedProfileId || isSaving}
            sx={{ textTransform: 'none', color: '#16334a', fontWeight: 600 }}
          >
            {isSaving ? 'Saving…' : 'Save as audio'}
          </Button>
        ) : null}

        {savedNarration && canSave && (
          <Button
            onClick={handleSave}
            startIcon={isSaving ? <CircularProgress size={16} /> : <ReplayIcon />}
            variant="text"
            disabled={!selectedProfileId || isSaving}
            sx={{ textTransform: 'none', color: '#546669' }}
          >
            {isSaving ? 'Re-saving…' : 'Replace saved'}
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Typography variant="caption" sx={{ color: '#888', fontStyle: 'italic' }}>
        Narration uses a cloned voice and is AI-generated. {narrationSource === 'original'
          ? 'Reading the original story text.'
          : 'Reading the approved first-person narration.'}
      </Typography>
    </Box>
  )
}
