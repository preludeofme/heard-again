import { useCallback, useRef, useState } from 'react'
import {
  Box,
  Chip,
  IconButton,
  Paper,
  Slider,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Download as DownloadIcon,
  SmartToy as AiIcon,
  Speed as SpeedIcon,
  VolumeUp as VolumeIcon,
  VolumeOff as VolumeMuteIcon,
} from '@mui/icons-material'
import { WaveformPlayer } from './WaveformPlayer'

interface AudioPlayerProps {
  audioUrl: string
  transcript?: string
  title?: string
  voiceName?: string
  isAiGenerated?: boolean
  onDownload?: () => void
  showTranscript?: boolean
  autoPlay?: boolean
}

export function AudioPlayer({
  audioUrl,
  transcript,
  title,
  voiceName,
  isAiGenerated = false,
  onDownload,
  showTranscript = true,
}: AudioPlayerProps) {
  const volumeAudioRef = useRef<HTMLAudioElement | null>(null)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)

  const handleVolumeChange = useCallback((_: Event, value: number | number[]) => {
    const v = value as number
    setVolume(v)
    setIsMuted(v === 0)
    if (volumeAudioRef.current) {
      volumeAudioRef.current.volume = v
    }
  }, [])

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted
    setIsMuted(newMuted)
    if (volumeAudioRef.current) {
      volumeAudioRef.current.muted = newMuted
    }
  }, [isMuted])

  const changePlaybackRate = useCallback(() => {
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2]
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length]
    setPlaybackRate(next)
    if (volumeAudioRef.current) {
      volumeAudioRef.current.playbackRate = next
    }
  }, [playbackRate])

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        bgcolor: 'rgba(208, 227, 230, 0.2)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isAiGenerated && (
            <Chip
              icon={<AiIcon fontSize="small" />}
              label="AI Generated"
              size="small"
              color="info"
              sx={{ fontSize: '0.75rem' }}
            />
          )}
          {voiceName && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Voice: {voiceName}
            </Typography>
          )}
        </Box>
        {onDownload && (
          <Tooltip title="Download audio">
            <IconButton size="small" onClick={onDownload}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Waveform player */}
      <Box sx={{ px: 3, py: 2 }}>
        {title && (
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500 }}>
            {title}
          </Typography>
        )}
        <WaveformPlayer audioUrl={audioUrl} />

        {/* Extra controls: volume + speed */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: 120 }}>
            <IconButton size="small" onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted || volume === 0 ? <VolumeMuteIcon /> : <VolumeIcon />}
            </IconButton>
            <Slider
              value={isMuted ? 0 : volume}
              max={1}
              step={0.1}
              onChange={handleVolumeChange}
              size="small"
            />
          </Box>
          <Tooltip title="Playback speed">
            <IconButton size="small" onClick={changePlaybackRate}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <SpeedIcon fontSize="small" />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {playbackRate}x
                </Typography>
              </Box>
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Transcript */}
      {showTranscript && transcript && (
        <Box
          sx={{
            px: 3,
            py: 2,
            bgcolor: 'rgba(255,255,255,0.5)',
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            Transcript
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.6 }}>
            {transcript}
          </Typography>
        </Box>
      )}
    </Paper>
  )
}
