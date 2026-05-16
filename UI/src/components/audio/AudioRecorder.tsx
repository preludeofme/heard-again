import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Box, Button, Typography, IconButton, Card, CardContent,
  LinearProgress, Alert, Chip, Slider,
} from '@mui/material'
import {
  Mic, Stop, PlayArrow, Pause, Delete, Send,
  CheckCircle, Warning, MicOff, Settings,
} from '@mui/icons-material'
import { VoiceCloneScript } from './VoiceCloneScript'

type MicPermission = 'checking' | 'prompt' | 'granted' | 'denied' | 'unsupported'

// Visible only in development — helps diagnose permission state on real devices
const IS_DEV = process.env.NODE_ENV === 'development'

interface AudioRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, duration: number) => void
  onCancel?: () => void
  maxDuration?: number // in seconds, default 300 (5 minutes)
  showScript?: boolean
}

export function AudioRecorder({
  onRecordingComplete,
  onCancel,
  maxDuration = 300,
  showScript = false,
}: AudioRecorderProps) {
  const [micPermission, setMicPermission] = useState<MicPermission>('checking')
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const [rawErrorName, setRawErrorName] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Check permission status on mount — without triggering a prompt
  useEffect(() => {
    if (typeof navigator === 'undefined') {
      setMicPermission('unsupported')
      return
    }
    // navigator.mediaDevices is hidden by browsers on non-HTTPS pages (except localhost).
    // Treat this as 'prompt' so we can show a helpful HTTPS message rather than "unsupported".
    if (!navigator.mediaDevices || !window.isSecureContext) {
      // localhost is always a secure context even over HTTP — mark as prompt so the
      // "Allow Microphone" button at least attempts getUserMedia there.
      setMicPermission('prompt')
      return
    }

    // Permissions API lets us query state without asking
    if (navigator.permissions) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((result) => {
          setMicPermission(result.state as MicPermission)
          // Keep in sync if the user changes it in browser settings while on the page
          result.onchange = () => setMicPermission(result.state as MicPermission)
        })
        .catch(() => {
          // Permissions API not available (e.g. Firefox private mode) — assume 'prompt'
          setMicPermission('prompt')
        })
    } else {
      // Safari < 16 doesn't support permissions.query for microphone — assume prompt
      setMicPermission('prompt')
    }
  }, [])

  const isInsecureContext = typeof window !== 'undefined' && !window.isSecureContext

  const requestMicAccess = useCallback(async () => {
    if (!navigator.mediaDevices) {
      setError('Microphone access requires a secure (HTTPS) connection. Ask your admin to enable HTTPS for this site.')
      return
    }
    setIsRequestingPermission(true)
    setError(null)
    try {
      // Calling getUserMedia IS the permission request — must be inside a user gesture
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Permission granted — immediately release the stream; we'll re-acquire when recording starts
      stream.getTracks().forEach((t) => t.stop())
      setMicPermission('granted')
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : 'UnknownError'
      const message = err instanceof Error ? err.message : String(err)
      setRawErrorName(`${name}: ${message}`)
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        // Chrome silently throws this when permission is blocked — no dialog will appear.
        // Show the step-by-step "reset in settings" screen instead of a dead button.
        setMicPermission('denied')
      } else if (name === 'NotFoundError') {
        setError('No microphone detected. Connect a microphone and try again.')
      } else {
        setError(`Could not access microphone (${name}). Check that no other app is using it.`)
      }
    } finally {
      setIsRequestingPermission(false)
    }
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startRecording = useCallback(async () => {
    setError(null)
    audioChunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Safari / iOS only supports audio/mp4; Chrome/Firefox support webm+opus
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : ''

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const recordedType = mimeType || 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type: recordedType })
        const url = URL.createObjectURL(blob)
        setAudioBlob(blob)
        setAudioUrl(url)
        stream.getTracks().forEach((t) => t.stop())
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(100)
      setIsRecording(true)
      setIsPaused(false)

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= maxDuration) {
            stopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)
    } catch {
      setError('Could not start recording. Check that no other app is using the microphone.')
    }
  }, [maxDuration])

  const pauseRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecording) return
    if (isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
      timerRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000)
    } else {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRecording, isPaused])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
    }
    if (timerRef.current) clearInterval(timerRef.current)
  }, [isRecording])

  const resetRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
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
      audioRef.current.onended = () => { setIsPlaying(false); setPlaybackTime(0) }
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) setPlaybackTime(audioRef.current.currentTime)
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
  void playbackProgress // used by Slider below

  // ── Permission gate screens ──────────────────────────────────────────────

  if (micPermission === 'checking') {
    return (
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <Mic sx={{ fontSize: 40, color: '#d0e3e6', mb: 2 }} />
          <Typography variant="body2" color="text.secondary">
            Checking microphone access…
          </Typography>
        </CardContent>
      </Card>
    )
  }

  if (micPermission === 'unsupported') {
    return (
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <MicOff sx={{ fontSize: 40, color: '#e53935', mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1, color: '#16334a' }}>
            Recording not supported
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Your browser doesn&apos;t support audio recording. Try Chrome, Safari, or Firefox.
          </Typography>
          <Button onClick={onCancel} sx={{ textTransform: 'none' }}>
            Upload a file instead
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (micPermission === 'denied') {
    return (
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <MicOff sx={{ fontSize: 28, color: '#e53935', flexShrink: 0 }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#16334a', lineHeight: 1.2 }}>
                Microphone access blocked
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Work through the steps below — one of them will fix it
              </Typography>
            </Box>
          </Box>

          {/* Step 1 — Android OS permission (most common root cause) */}
          <Alert severity="warning" sx={{ mb: 1.5, textAlign: 'left' }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Step 1 — Check Android system permission
            </Typography>
            <Typography variant="body2" component="div">
              Chrome needs OS-level microphone permission first:
              <Box component="ol" sx={{ m: '4px 0 0', pl: 2.5, lineHeight: 1.9 }}>
                <li>Open Android <strong>Settings</strong></li>
                <li>Tap <strong>Apps</strong> → <strong>Chrome</strong></li>
                <li>Tap <strong>Permissions</strong> → <strong>Microphone</strong></li>
                <li>Set to <strong>Allow only while using the app</strong></li>
              </Box>
            </Typography>
          </Alert>

          {/* Step 2 — Chrome site permission */}
          <Alert severity="info" sx={{ mb: 1.5, textAlign: 'left' }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Step 2 — Reset Chrome site permission
            </Typography>
            <Typography variant="body2" component="div">
              <Box component="ol" sx={{ m: 0, pl: 2.5, lineHeight: 1.9 }}>
                <li>Tap the <strong>lock icon</strong> in Chrome&apos;s address bar</li>
                <li>Tap <strong>Permissions</strong></li>
                <li>Tap <strong>Microphone</strong> → set to <strong>Allow</strong></li>
              </Box>
            </Typography>
          </Alert>

          {/* Dev diagnostics — only in development */}
          {IS_DEV && rawErrorName && (
            <Alert severity="error" sx={{ mb: 1.5, textAlign: 'left' }}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {rawErrorName}
              </Typography>
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 2 }}>
            <Button
              size="small"
              onClick={onCancel}
              sx={{ textTransform: 'none', color: '#546669' }}
            >
              Upload a file instead
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => window.location.reload()}
              sx={{ textTransform: 'none', bgcolor: '#16334a', '&:hover': { bgcolor: '#2e4a62' }, ml: 'auto' }}
            >
              Reload &amp; try again
            </Button>
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (micPermission === 'prompt') {
    return (
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'rgba(22,51,74,0.07)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
            }}
          >
            <Mic sx={{ fontSize: 40, color: '#16334a' }} />
          </Box>
          <Typography variant="h6" sx={{ mb: 1, color: '#16334a', fontFamily: 'var(--font-newsreader), serif' }}>
            Allow microphone access
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, maxWidth: 300, mx: 'auto' }}>
            Heard Again needs your microphone to record voice samples for cloning.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3, maxWidth: 280, mx: 'auto' }}>
            Your recordings are only used to create a voice profile and are never shared.
          </Typography>

          {/* Dev diagnostics */}
          {IS_DEV && (
            <Alert severity="info" sx={{ mb: 2, textAlign: 'left' }}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                secureContext: {String(window.isSecureContext)} | mediaDevices: {String(!!navigator.mediaDevices)} | permState: {micPermission}
                {rawErrorName ? ` | lastError: ${rawErrorName}` : ''}
              </Typography>
            </Alert>
          )}

          {/* HTTPS warning — shown when mediaDevices is blocked due to insecure context */}
          {isInsecureContext && (
            <Alert severity="warning" icon={<Warning />} sx={{ mb: 2, textAlign: 'left' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                HTTPS required for microphone
              </Typography>
              <Typography variant="body2">
                Chrome blocks microphone access on non-HTTPS pages. Access this app over{' '}
                <strong>https://</strong> to enable recording.
              </Typography>
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
              {error}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 280, mx: 'auto' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<Mic />}
              onClick={requestMicAccess}
              disabled={isRequestingPermission || isInsecureContext}
              sx={{
                borderRadius: 50,
                py: 1.5,
                bgcolor: '#16334a',
                '&:hover': { bgcolor: '#2e4a62' },
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              {isRequestingPermission ? 'Requesting access…' : 'Allow Microphone'}
            </Button>
            <Button
              size="small"
              onClick={onCancel}
              sx={{ textTransform: 'none', color: '#546669' }}
            >
              Upload a file instead
            </Button>
          </Box>
        </CardContent>
      </Card>
    )
  }

  // ── Permission granted — show recorder ──────────────────────────────────

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
                {isRecording ? (isPaused ? 'Paused' : 'Recording…') : 'Ready to record'}
              </Typography>
            </Box>

            {/* Controls — hidden when script is showing (script owns start/stop above + below) */}
            {!showScript && (
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 3 }}>
                {!isRecording ? (
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<Mic />}
                    onClick={startRecording}
                    sx={{
                      borderRadius: 50,
                      px: 4,
                      py: 1.5,
                      backgroundColor: '#e53935',
                      textTransform: 'none',
                      fontWeight: 600,
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
                      aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
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
                      aria-label="Stop recording"
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
            )}

            {isRecording && (
              <Box sx={{ mb: 4, px: 4 }}>
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

            {showScript && (
              <VoiceCloneScript
                isRecording={isRecording}
                isPaused={isPaused}
                onStart={startRecording}
                onStop={stopRecording}
                onPause={pauseRecording}
              />
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

            <Box sx={{ backgroundColor: '#f5f5f5', borderRadius: 3, p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton
                  onClick={togglePlayback}
                  aria-label={isPlaying ? 'Pause playback' : 'Play recording'}
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
                    sx={{ color: '#16334a', '& .MuiSlider-thumb': { width: 12, height: 12 } }}
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
                <Button onClick={onCancel} sx={{ textTransform: 'none' }}>
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
