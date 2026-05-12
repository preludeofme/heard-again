
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  IconButton,
  Slider,
  Paper,
  Chip,
  Tooltip,
  LinearProgress,
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  VolumeUp as VolumeIcon,
  VolumeOff as VolumeMuteIcon,
  Download as DownloadIcon,
  SmartToy as AiIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material'

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
  autoPlay = false,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const audio = new Audio(audioUrl)
    audioRef.current = audio

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      setIsLoading(false)
      if (autoPlay) {
        audio.play().catch(() => {
          // Auto-play blocked by browser
        })
      }
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    const handleError = () => {
      setError('Failed to load audio')
      setIsLoading(false)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    // Preload the audio
    audio.load()

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.pause()
      audioRef.current = null
    }
  }, [audioUrl, autoPlay])

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }, [isPlaying])

  const handleStop = useCallback(() => {
    if (!audioRef.current) return
    audioRef.current.pause()
    audioRef.current.currentTime = 0
    setIsPlaying(false)
    setCurrentTime(0)
  }, [])

  const handleSeek = useCallback((_: Event, value: number | number[]) => {
    if (!audioRef.current) return
    const newTime = value as number
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }, [])

  const handleVolumeChange = useCallback((_: Event, value: number | number[]) => {
    if (!audioRef.current) return
    const newVolume = value as number
    setVolume(newVolume)
    audioRef.current.volume = newVolume
    setIsMuted(newVolume === 0)
  }, [])

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return
    const newMuted = !isMuted
    setIsMuted(newMuted)
    audioRef.current.muted = newMuted
  }, [isMuted])

  const changePlaybackRate = useCallback(() => {
    if (!audioRef.current) return
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2]
    const currentIndex = rates.indexOf(playbackRate)
    const nextRate = rates[(currentIndex + 1) % rates.length]
    audioRef.current.playbackRate = nextRate
    setPlaybackRate(nextRate)
  }, [playbackRate])

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (error) {
    return (
      <Paper sx={{ p: 3, borderRadius: 3, bgcolor: 'error.light' }}>
        <Typography color="error">{error}</Typography>
      </Paper>
    )
  }

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        bgcolor: 'rgba(208, 227, 230, 0.2)',
        overflow: 'hidden',
      }}
    >
      {/* Header with AI indicator */}
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

      {/* Player controls */}
      <Box sx={{ px: 3, py: 2 }}>
        {title && (
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500 }}>
            {title}
          </Typography>
        )}

        {/* Progress bar */}
        <Box sx={{ mb: 2 }}>
          {isLoading ? (
            <LinearProgress />
          ) : (
            <>
              <Slider
                value={currentTime}
                max={duration || 100}
                onChange={handleSeek}
                sx={{
                  '& .MuiSlider-thumb': {
                    width: 12,
                    height: 12,
                  },
                }}
              />
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mt: 0.5,
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {formatTime(currentTime)}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {formatTime(duration)}
                </Typography>
              </Box>
            </>
          )}
        </Box>

        {/* Control buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            onClick={togglePlay}
            disabled={isLoading}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': { bgcolor: 'primary.dark' },
              '&:disabled': { bgcolor: 'grey.300' },
            }}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </IconButton>

          <IconButton onClick={handleStop} disabled={isLoading || !isPlaying} aria-label="Stop">
            <StopIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1 }} />

          {/* Volume control */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: 120 }}>
            <IconButton size="small" onClick={toggleMute} aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}>
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

          {/* Playback rate */}
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

      {/* Transcript section */}
      {showTranscript && transcript && (
        <Box
          sx={{
            px: 3,
            py: 2,
            bgcolor: 'rgba(255, 255, 255, 0.5)',
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
