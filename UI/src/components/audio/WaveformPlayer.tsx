import { useState, useRef, useEffect } from 'react'
import { Box, Typography, IconButton } from '@mui/material'
import { PlayArrow, Stop } from '@mui/icons-material'
import { ProfileColors, WAVEFORM_HEIGHTS } from '@/components/profile/ProfileConstants'

export interface WaveformPlayerProps {
  audioUrl: string | null
  label?: string
}

function formatTime(s: number): string {
  if (!isFinite(s) || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function WaveformPlayer({ audioUrl, label }: WaveformPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (!audioUrl) return
    const audio = new Audio(audioUrl)
    audioRef.current = audio

    const onLoaded = () => setDuration(audio.duration)
    const onTime = () => {
      setCurrentTime(audio.currentTime)
      setProgress(audio.duration > 0 ? audio.currentTime / audio.duration : 0)
    }
    const onEnded = () => {
      setIsPlaying(false)
      setProgress(0)
      setCurrentTime(0)
    }

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnded)
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [audioUrl])

  const handleToggle = () => {
    if (!audioRef.current || !audioUrl) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play().catch(() => setIsPlaying(false))
      setIsPlaying(true)
    }
  }

  return (
    <Box>
      {label && (
        <Typography
          sx={{
            fontFamily: 'var(--font-manrope), sans-serif',
            fontSize: '0.78rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: ProfileColors.onSurfaceVariant,
            mb: 1,
          }}
        >
          {label}
        </Typography>
      )}

      {/* Waveform bars */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 48, mb: 1.5 }}>
        {WAVEFORM_HEIGHTS.map((h, i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              height: h * 1.8,
              borderRadius: '9999px',
              bgcolor: isPlaying ? ProfileColors.primary : ProfileColors.outlineVariant,
              opacity: isPlaying ? 1 : 0.4,
              transition: 'opacity 0.3s, background-color 0.3s',
              ...(isPlaying && {
                animation: `waveformBounce ${0.6 + (i % 5) * 0.1}s ease-in-out infinite alternate`,
                '@keyframes waveformBounce': {
                  from: { height: h },
                  to: { height: h * 2.4 },
                },
              }),
            }}
          />
        ))}
      </Box>

      {/* Progress bar */}
      <Box
        sx={{
          height: 3,
          borderRadius: '9999px',
          bgcolor: `${ProfileColors.outlineVariant}50`,
          mb: 1.5,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${progress * 100}%`,
            bgcolor: ProfileColors.primary,
            borderRadius: '9999px',
            transition: 'width 0.1s linear',
          }}
        />
      </Box>

      {/* Controls row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <IconButton
          onClick={handleToggle}
          disabled={!audioUrl}
          aria-label={isPlaying ? 'Stop' : 'Play'}
          sx={{
            width: 40,
            height: 40,
            bgcolor: audioUrl ? ProfileColors.primary : ProfileColors.outlineVariant,
            color: '#fff',
            flexShrink: 0,
            '&:hover': { bgcolor: ProfileColors.primaryContainer },
            '&:disabled': { bgcolor: ProfileColors.outlineVariant, color: '#fff' },
          }}
        >
          {isPlaying ? <Stop sx={{ fontSize: 20 }} /> : <PlayArrow sx={{ fontSize: 20 }} />}
        </IconButton>

        <Typography
          sx={{
            fontFamily: 'var(--font-manrope), sans-serif',
            fontSize: '0.72rem',
            color: ProfileColors.onSurfaceVariant,
            whiteSpace: 'nowrap',
          }}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </Typography>
      </Box>
    </Box>
  )
}
