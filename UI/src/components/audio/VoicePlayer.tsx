import { useState, useRef, useEffect } from 'react'
import { Box, Typography, IconButton, LinearProgress } from '@mui/material'
import { PlayArrow as PlayIcon, Stop as StopIcon } from '@mui/icons-material'
import { ProfileColors, WAVEFORM_HEIGHTS } from '@/components/profile/ProfileConstants'

interface VoicePlayerProps {
  personName: string
  storyTitle: string
  audioUrl: string
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VoicePlayer({ personName, storyTitle, audioUrl }: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = new Audio(audioUrl)
    audioRef.current = audio

    const onLoaded = () => setDuration(audio.duration)
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onEnded = () => setIsPlaying(false)

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.pause()
      audio.src = ''
    }
  }, [audioUrl])

  const handleToggle = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play().catch(() => setIsPlaying(false))
      setIsPlaying(true)
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <Box
      sx={{
        p: 3,
        backgroundColor: ProfileColors.surfaceContainerLow,
        borderRadius: 4,
        border: `1px solid ${ProfileColors.outlineVariant}20`,
      }}
    >
      <Typography
        sx={{
          fontFamily: 'var(--font-manrope), sans-serif',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: ProfileColors.onSurfaceVariant,
          mb: 0.5,
        }}
      >
        {personName}'s Voice
      </Typography>
      <Typography
        sx={{
          fontFamily: 'var(--font-newsreader), serif',
          fontSize: '1.1rem',
          fontWeight: 700,
          color: ProfileColors.primary,
          mb: 2,
        }}
      >
        {storyTitle}
      </Typography>

      {/* Decorative waveform (static bars, not live) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '3px', height: 32, mb: 2 }}>
        {WAVEFORM_HEIGHTS.map((h, i) => (
          <Box
            key={i}
            sx={{
              width: 3,
              height: h,
              borderRadius: 1,
              bgcolor: isPlaying ? ProfileColors.primary : ProfileColors.outlineVariant,
              opacity: isPlaying ? 1 : 0.35,
              transition: 'opacity 0.3s, background-color 0.3s',
              animation: isPlaying ? 'voiceWave 1.2s infinite ease-in-out' : 'none',
              animationDelay: `${i * 0.06}s`,
              '@keyframes voiceWave': {
                '0%, 100%': { transform: 'scaleY(1)' },
                '50%': { transform: 'scaleY(1.5)' },
              },
            }}
          />
        ))}
      </Box>

      {/* Controls row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton
          onClick={handleToggle}
          aria-label={isPlaying ? `Stop ${personName}'s voice` : `Hear ${personName} tell this story`}
          sx={{
            bgcolor: ProfileColors.primary,
            color: '#fff',
            width: 40,
            height: 40,
            flexShrink: 0,
            '&:hover': { bgcolor: ProfileColors.primaryContainer },
          }}
        >
          {isPlaying ? <StopIcon sx={{ fontSize: 20 }} /> : <PlayIcon sx={{ fontSize: 20 }} />}
        </IconButton>

        <Box sx={{ flex: 1 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 4,
              borderRadius: 2,
              bgcolor: `${ProfileColors.outlineVariant}30`,
              '& .MuiLinearProgress-bar': { bgcolor: ProfileColors.primary, borderRadius: 2 },
            }}
          />
        </Box>

        <Typography
          sx={{
            fontFamily: 'var(--font-manrope), sans-serif',
            fontSize: '0.75rem',
            color: ProfileColors.onSurfaceVariant,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </Typography>
      </Box>
    </Box>
  )
}
