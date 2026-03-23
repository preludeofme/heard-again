import { useState, useRef, useCallback } from 'react'
import {
  Box, Button, Typography, IconButton, Card, CardContent,
  LinearProgress, Alert, Chip, Slider,
} from '@mui/material'
import {
  Mic, Stop, PlayArrow, Pause, Delete, Send,
  CheckCircle, Warning,
} from '@mui/icons-material'

interface AudioRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, duration: number) => void
  onCancel?: () => void
  maxDuration?: number // in seconds, default 300 (5 minutes)
}

export function AudioRecorder({ 
  onRecordingComplete, 
  onCancel, 
  maxDuration = 300 
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startRecording = useCallback(async () => {
    setError(null)
    setPermissionDenied(false)
    audioChunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const audioUrl = URL.createObjectURL(audioBlob)
        setAudioBlob(audioBlob)
        setAudioUrl(audioUrl)
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(100) // Collect data every 100ms
      setIsRecording(true)
      setIsPaused(false)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration) {
            stopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true)
        setError('Microphone access denied. Please allow microphone access in your browser settings.')
      } else {
        setError('Could not access microphone. Please check your device.')
      }
    }
  }, [maxDuration])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume()
        setIsPaused(false)
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1)
        }, 1000)
      } else {
        mediaRecorderRef.current.pause()
        setIsPaused(true)
        if (timerRef.current) {
          clearInterval(timerRef.current)
        }
      }
    }
  }, [isRecording, isPaused])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
  }, [isRecording])

  const resetRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setAudioBlob(null)
    setAudioUrl(null)
    setRecordingTime(0)
    setPlaybackTime(0)
    setIsPlaying(false)
    setError(null)
  }, [audioUrl])

  const togglePlayback = useCallback(() => {
    if (!audioUrl) return

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)
      audioRef.current.onended = () => {
        setIsPlaying(false)
        setPlaybackTime(0)
      }
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) {
          setPlaybackTime(audioRef.current.currentTime)
        }
      }
    }

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }, [audioUrl, isPlaying])

  const handleSubmit = useCallback(() => {
    if (audioBlob && recordingTime > 0) {
      onRecordingComplete?.(audioBlob, recordingTime)
    }
  }, [audioBlob, recordingTime, onRecordingComplete])

  const recordingProgress = (recordingTime / maxDuration) * 100
  const playbackProgress = audioRef.current ? (playbackTime / recordingTime) * 100 : 0

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: 4 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {!audioBlob ? (
          // Recording Phase
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="h2"
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 300,
                  color: isRecording ? (isPaused ? '#999' : '#e53935') : '#16334a',
                  letterSpacing: 2,
                }}
              >
                {formatTime(recordingTime)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {isRecording ? (isPaused ? 'Paused' : 'Recording...') : 'Ready to record'}
              </Typography>
            </Box>

            {isRecording && (
              <Box sx={{ mb: 3, px: 4 }}>
                <LinearProgress
                  variant="determinate"
                  value={recordingProgress}
                  sx={{
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: '#f0f0f0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: isPaused ? '#999' : '#e53935',
                    },
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {formatTime(maxDuration - recordingTime)} remaining
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 3 }}>
              {!isRecording ? (
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<Mic />}
                  onClick={startRecording}
                  disabled={permissionDenied}
                  sx={{
                    borderRadius: 50,
                    px: 4,
                    py: 1.5,
                    backgroundColor: '#e53935',
                    '&:hover': { backgroundColor: '#c62828' },
                  }}
                >
                  Start Recording
                </Button>
              ) : (
                <>
                  <IconButton
                    size="large"
                    onClick={pauseRecording}
                    sx={{
                      width: 56,
                      height: 56,
                      backgroundColor: '#f5f5f5',
                      '&:hover': { backgroundColor: '#e0e0e0' },
                    }}
                  >
                    {isPaused ? <PlayArrow /> : <Pause />}
                  </IconButton>
                  <IconButton
                    size="large"
                    onClick={stopRecording}
                    sx={{
                      width: 72,
                      height: 72,
                      backgroundColor: '#e53935',
                      color: 'white',
                      '&:hover': { backgroundColor: '#c62828' },
                    }}
                  >
                    <Stop />
                  </IconButton>
                </>
              )}
            </Box>

            {permissionDenied && (
              <Alert severity="warning" sx={{ mt: 2 }} icon={<Warning />}>
                Microphone access is required to record audio. Please check your browser permissions.
              </Alert>
            )}
          </Box>
        ) : (
          // Review Phase
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Chip
                icon={<CheckCircle />}
                label={`Recorded ${formatTime(recordingTime)}`}
                color="success"
                size="small"
              />
            </Box>

            {/* Playback Controls */}
            <Box
              sx={{
                backgroundColor: '#f5f5f5',
                borderRadius: 3,
                p: 3,
                mb: 3,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton
                  onClick={togglePlayback}
                  sx={{
                    width: 48,
                    height: 48,
                    backgroundColor: '#16334a',
                    color: 'white',
                    '&:hover': { backgroundColor: '#2e4a62' },
                  }}
                >
                  {isPlaying ? <Pause /> : <PlayArrow />}
                </IconButton>

                <Box sx={{ flex: 1 }}>
                  <Slider
                    value={playbackTime}
                    max={recordingTime}
                    onChange={(_, value) => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = value as number
                        setPlaybackTime(value as number)
                      }
                    }}
                    sx={{
                      color: '#16334a',
                      '& .MuiSlider-thumb': { width: 12, height: 12 },
                    }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      {formatTime(playbackTime)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatTime(recordingTime)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button
                startIcon={<Delete />}
                onClick={resetRecording}
                color="error"
                sx={{ textTransform: 'none' }}
              >
                Discard
              </Button>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  onClick={onCancel}
                  sx={{ textTransform: 'none' }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Send />}
                  onClick={handleSubmit}
                  sx={{ textTransform: 'none', borderRadius: 2 }}
                >
                  Save Recording
                </Button>
              </Box>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
