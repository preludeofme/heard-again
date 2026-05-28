import React, { useState, useRef, useEffect } from 'react'
import { Box, Typography, IconButton, Alert, Tooltip } from '@mui/material'
import { Replay10, Forward30, PlayArrow, Stop, ChevronLeft, ChevronRight } from '@mui/icons-material'
import Link from 'next/link'
import { ProfileColors, WAVEFORM_HEIGHTS } from './ProfileConstants'

interface VoiceSignatureProps {
  personId?: string
  firstName?: string
  bio?: string | null
  voiceProfiles?: Array<{ id: string; name: string; isDefault: boolean; isCloned: boolean; sampleAudioUrl?: string | null }>
  isGlobal?: boolean
  stats?: {
    totalRecordings: number
    totalVoices: number
  }
}

export function VoiceSignature({ 
  personId, 
  firstName, 
  bio, 
  voiceProfiles, 
  isGlobal = false,
  stats 
}: VoiceSignatureProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  
  // Set initial index to the default voice if available
  useEffect(() => {
    if (voiceProfiles && voiceProfiles.length > 0) {
      const defaultIdx = voiceProfiles.findIndex(v => v.isDefault)
      if (defaultIdx !== -1) setCurrentIndex(defaultIdx)
    }
  }, [voiceProfiles])

  const currentVoice = voiceProfiles?.[currentIndex] ?? null
  const hasClonedVoice = !!currentVoice?.isCloned
  const hasAnyVoice = voiceProfiles && voiceProfiles.length > 0
  const hasSample = !!currentVoice?.sampleAudioUrl
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [playError, setPlayError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handlePrev = () => {
    if (!voiceProfiles || voiceProfiles.length <= 1) return
    setCurrentIndex((prev) => (prev === 0 ? voiceProfiles.length - 1 : prev - 1))
    if (isPlaying && audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }

  const handleNext = () => {
    if (!voiceProfiles || voiceProfiles.length <= 1) return
    setCurrentIndex((prev) => (prev === voiceProfiles.length - 1 ? 0 : prev + 1))
    if (isPlaying && audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }

  const handlePlaySample = () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setIsPlaying(false)
      return
    }

    const audioUrl = currentVoice?.sampleAudioUrl ?? null
    if (!audioUrl) return

    setPlayError(null)
    const audio = new Audio(audioUrl)
    audioRef.current = audio

    audio.onerror = () => {
      setIsPlaying(false)
      audioRef.current = null
      setPlayError('Playback failed. Please try again.')
    }
    audio.onended = () => {
      setIsPlaying(false)
      audioRef.current = null
    }

    setIsPlaying(true)
    audio.play()
  }

  return (
    <Box
      sx={{
        gridColumn: { xs: '1', md: '1 / 9' },
        bgcolor: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(24px)',
        borderRadius: '2rem',
        p: { xs: 3, md: 4.5 },
        boxShadow: '0 10px 40px rgba(28,28,25,0.04)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 380,
      }}
    >
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
          <Box>
            <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '1.875rem', fontWeight: 700, color: ProfileColors.primary }}>
              {isGlobal ? 'Story Voice' : 'Voice Signature'}
            </Typography>
            {currentVoice && !isGlobal && (
              <Typography sx={{ fontFamily: 'var(--font-manrope), sans-serif', fontSize: '0.85rem', color: ProfileColors.onSurfaceVariant, mt: 0.5 }}>
                Model: {currentVoice.name}
              </Typography>
            )}
          </Box>
          
          {isGlobal ? (
            <Box sx={{ bgcolor: ProfileColors.secondaryContainer, color: ProfileColors.onSecondaryContainer, px: 2, py: 0.5, borderRadius: '9999px', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-manrope), sans-serif' }}>
              {stats?.totalVoices || 0} Saved Voices
            </Box>
          ) : hasClonedVoice ? (
            <Box sx={{ bgcolor: ProfileColors.tertiaryFixed, color: ProfileColors.onTertiaryFixedVariant, px: 2, py: 0.5, borderRadius: '9999px', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-manrope), sans-serif' }}>
              Verified AI Clone
            </Box>
          ) : hasAnyVoice ? (
            <Box sx={{ bgcolor: ProfileColors.secondaryContainer, color: ProfileColors.onSecondaryContainer, px: 2, py: 0.5, borderRadius: '9999px', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-manrope), sans-serif' }}>
              Voice Profile
            </Box>
          ) : (
            <Box sx={{ bgcolor: '#fff3e0', color: '#e65100', px: 2, py: 0.5, borderRadius: '9999px', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-manrope), sans-serif' }}>
              Model Needed
            </Box>
          )}
        </Box>

        {/* Waveform */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: 88, mb: 4 }}>
          {hasAnyVoice ? (
            WAVEFORM_HEIGHTS.map((h, i) => (
              <Box
                key={i}
                sx={{
                  flex: 1,
                  height: h * 3.5,
                  borderRadius: '9999px',
                  bgcolor: i >= 2 && i <= 6 ? ProfileColors.primary : ProfileColors.tertiaryFixedDim,
                  opacity: isPlaying ? 1 : 0.6,
                  transition: 'height 0.2s',
                  ...(isPlaying && {
                    animation: `waveform-pulse ${0.5 + Math.random()}s ease-in-out infinite alternate`,
                    '@keyframes waveform-pulse': {
                      from: { height: h * 2 },
                      to: { height: h * 5 },
                    }
                  })
                }}
              />
            ))
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', border: '1px dashed #dcdad5', borderRadius: 4, bgcolor: 'rgba(0,0,0,0.02)' }}>
              <Typography sx={{ fontFamily: 'var(--font-manrope), sans-serif', fontSize: '0.8rem', color: ProfileColors.onSurfaceVariant, opacity: 0.5 }}>
                No voice pattern detected
              </Typography>
            </Box>
          )}
        </Box>

        {/* Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 1, md: 3 } }}>
          {voiceProfiles && voiceProfiles.length > 1 && (
            <IconButton onClick={handlePrev} sx={{ color: ProfileColors.primary }} aria-label="Previous voice model">
              <ChevronLeft fontSize="large" />
            </IconButton>
          )}
          <IconButton sx={{ color: ProfileColors.primary, opacity: 0.35 }} aria-label="Replay 10 seconds">
            <Replay10 sx={{ fontSize: 28 }} />
          </IconButton>
          <Tooltip title={hasAnyVoice && !hasSample ? 'Sample not yet available — check back shortly' : ''} disableHoverListener={!hasAnyVoice || hasSample}>
            <Box
              onClick={hasSample ? handlePlaySample : undefined}
              sx={{
                width: 60,
                height: 60,
                bgcolor: hasSample ? ProfileColors.primary : '#dcdad5',
                color: '#fff',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                boxShadow: hasSample ? '0 6px 24px rgba(22,51,74,0.3)' : 'none',
                transition: 'transform 0.15s, opacity 0.15s',
                cursor: hasSample ? 'pointer' : 'default',
                '&:hover': hasSample ? { opacity: 0.9 } : {},
                '&:active': hasSample ? { transform: 'scale(0.92)' } : {},
              }}
              aria-label={hasSample ? 'Play voice sample' : 'Sample not yet available'}
            >
              {isPlaying ? (
                <Stop sx={{ fontSize: 34 }} />
              ) : (
                <PlayArrow sx={{ fontSize: 34 }} />
              )}
            </Box>
          </Tooltip>
          <IconButton sx={{ color: ProfileColors.primary, opacity: 0.35 }} aria-label="Forward 30 seconds">
            <Forward30 sx={{ fontSize: 28 }} />
          </IconButton>
          {voiceProfiles && voiceProfiles.length > 1 && (
            <IconButton onClick={handleNext} sx={{ color: ProfileColors.primary }} aria-label="Next voice model">
              <ChevronRight fontSize="large" />
            </IconButton>
          )}
        </Box>

        {playError && (
          <Alert severity="warning" sx={{ mt: 2, textAlign: 'left' }}>
            {playError}
          </Alert>
        )}
      </Box>

      {/* Quote or Stats */}
      <Box sx={{ mt: 4 }}>
        {isGlobal ? (
          <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontStyle: 'italic', fontSize: '1.05rem', color: ProfileColors.primary, textAlign: 'center', lineHeight: 1.6 }}>
            &ldquo;Preserving the unique cadence and character of every family voice.&rdquo;
          </Typography>
        ) : hasAnyVoice && bio ? (
          <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontStyle: 'italic', fontSize: '1.05rem', color: ProfileColors.primary, textAlign: 'center', lineHeight: 1.6 }}>
            &ldquo;{bio.length > 130 ? bio.substring(0, 130).trimEnd() + '\u2026' : bio}&rdquo;
          </Typography>
        ) : !hasAnyVoice ? (
          <Box sx={{ textAlign: 'center' }}>
            <Box
              component={Link}
              href={`/legacy?lens=voices&personId=${personId}&create=true`}
              sx={{ fontFamily: 'var(--font-manrope), sans-serif', fontSize: '0.85rem', color: ProfileColors.onSurfaceVariant, textDecoration: 'none', borderBottom: `1px solid ${ProfileColors.outlineVariant}`, pb: 0.25, '&:hover': { color: ProfileColors.primary } }}
            >
              + Create Voice Profile in Voice Lab
            </Box>
          </Box>
        ) : null}
        {hasAnyVoice && !isGlobal && (
          <Box sx={{ textAlign: 'center', mt: 1.5 }}>
            <Box
              component={Link}
              href={`/legacy?lens=voices&personId=${personId}&create=true`}
              sx={{ fontFamily: 'var(--font-manrope), sans-serif', fontSize: '0.8rem', color: ProfileColors.onSurfaceVariant, textDecoration: 'none', borderBottom: `1px solid ${ProfileColors.outlineVariant}50`, pb: 0.25, '&:hover': { color: ProfileColors.primary } }}
            >
              + Create another voice
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}
