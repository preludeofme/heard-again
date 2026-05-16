import dynamic from 'next/dynamic'
import React, { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Chip,
  IconButton,
  LinearProgress,
  Alert,
  CircularProgress,
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  AudioFile as AudioFileIcon,
  RecordVoiceOver as VoiceIcon,
  Mic as MicIcon,
} from '@mui/icons-material'

// Dynamically import client-side components to avoid SSR errors
const AudioTrimmer = dynamic(() => import('./AudioTrimmer').then(mod => mod.AudioTrimmer), {
  ssr: false,
  loading: () => <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={24} /></Box>
})

const AudioRecorder = dynamic(() => import('./AudioRecorder').then(mod => mod.AudioRecorder), {
  ssr: false,
  loading: () => <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={24} /></Box>
})

interface VoiceTrainingModalProps {
  open: boolean
  onClose: () => void
  personId?: string
  trainingSamples: File[]
  onUploadSample: (file: File, personId?: string) => Promise<void>
  onRemoveSample: (index: number) => void
  onCreateVoice: (modelName: string, language: string, styleInstruct?: string) => Promise<void>
  onResetTraining: () => void
  onRecordConsent?: (modelId: string) => void
  isUploading: boolean
  isTraining: boolean
  trainingJob: { status?: string; modelId?: string } | null
}

const STYLE_SUGGESTIONS = [
  'Warm and gentle, slow deliberate pace',
  'Energetic and upbeat, fast-talking',
  'Calm and soothing, like reading a bedtime story',
  'Cheerful with a slight southern drawl',
  'Soft-spoken and thoughtful, with long pauses',
  'Strong and confident, clear enunciation',
]

export function VoiceTrainingModal({
  open,
  onClose,
  personId,
  trainingSamples,
  onUploadSample,
  onRemoveSample,
  onCreateVoice,
  onResetTraining,
  onRecordConsent,
  isUploading,
  isTraining,
  trainingJob,
}: VoiceTrainingModalProps) {
  const [voiceName, setVoiceName] = useState('')
  const [voiceDescription, setVoiceDescription] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Source tab: upload a file vs. record in-browser ──
  const [sourceTab, setSourceTab] = useState<'upload' | 'record'>('upload')

  // ── Local file state (before trimming / upload) ──
  const [rawFile, setRawFile] = useState<File | null>(null)
  const [isTrimming, setIsTrimming] = useState(false)

  // ── Reset state when modal is closed ──
  useEffect(() => {
    if (!open) {
      // Small timeout to avoid UI flicker during close animation
      const timer = setTimeout(() => {
        setVoiceName('')
        setVoiceDescription('')
        setRawFile(null)
        setIsTrimming(false)
        onResetTraining()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [open, onResetTraining])

  const handleFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setRawFile(file)
      setIsTrimming(true)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleTrimComplete = async (trimmedFile: File) => {
    setIsTrimming(false)
    setRawFile(null)
    await onUploadSample(trimmedFile, personId)
  }

  const handleDiscardFile = () => {
    setRawFile(null)
    setIsTrimming(false)
  }

  const handleRemoveUploaded = () => {
    onRemoveSample(0)
    setRawFile(null)
    setIsTrimming(false)
  }

  const handleCreate = async () => {
    if (!voiceName.trim() || trainingSamples.length === 0) return
    await onCreateVoice(
      voiceName.trim(),
      'English',
      voiceDescription.trim() || undefined,
    )
  }

  const handleClose = () => {
    if (!isTraining) {
      onClose()
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setVoiceDescription(suggestion)
  }

  const handleRecordingComplete = async (audioBlob: Blob, _duration: number) => {
    const ext = audioBlob.type.includes('mp4') ? 'm4a' : 'webm'
    const file = new File([audioBlob], `recording-${Date.now()}.${ext}`, { type: audioBlob.type })
    await onUploadSample(file, personId)
  }

  const isComplete = trainingJob?.status === 'completed'
  const hasAudio = trainingSamples.length > 0
  const canCreate = hasAudio && voiceName.trim().length > 0 && !isTraining

  // For navigating to consent from success state
  const handleRecordConsent = () => {
    if (onRecordConsent) {
      onRecordConsent(trainingJob?.modelId ?? '')
    } else {
      handleClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="voice-training-dialog-title"
      PaperProps={{
        sx: {
          borderRadius: 3,
          backgroundColor: '#fcf9f4',
        },
      }}
    >
      <DialogTitle id="voice-training-dialog-title" sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h5" className="serif-font" sx={{ color: '#16334a', fontWeight: 600 }}>
              Create Voice
            </Typography>
            <Typography variant="body2" sx={{ color: '#546669', mt: 0.5 }}>
              Upload a recording and describe how they sound
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" disabled={isTraining}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2, position: 'relative' }}>
        {isUploading && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              bgcolor: 'rgba(252, 249, 244, 0.75)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
            }}
          >
            <CircularProgress size={36} sx={{ color: '#16334a' }} />
            <Typography variant='body2' sx={{ color: '#16334a', fontWeight: 600 }}>
              Uploading your clip…
            </Typography>
            <Typography variant='caption' sx={{ color: '#546669' }}>
              Please wait while we upload and transcribe the selected audio.
            </Typography>
          </Box>
        )}
        {/* ── Success State ── */}
        {isComplete ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: '#4caf50', mb: 2 }} />
            <Typography variant="h5" className="serif-font" sx={{ color: '#16334a', mb: 1 }}>
              Voice Created!
            </Typography>
            <Typography variant="body1" sx={{ color: '#546669', mb: 1 }}>
              <strong>{voiceName || trainingJob?.modelId}</strong> is ready to use.
            </Typography>
            <Typography variant="body2" sx={{ color: '#8a9a9d', mb: 3 }}>
              You need to record consent before you can generate speech with this voice.
            </Typography>
            <Button
              variant="outlined"
              onClick={handleClose}
              sx={{ color: '#16334a', borderColor: '#16334a', textTransform: 'none' }}
            >
              I'll do it later
            </Button>
          </Box>
        ) : (
          <Box>
            {/* ── Step 1: Pick & Trim Audio ── */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ color: '#16334a', mb: 1.5, fontWeight: 600 }}>
                1. Add a voice recording
              </Typography>

              {/* Source tab toggle — only visible before audio is locked in */}
              {!hasAudio && (
                <Box
                  sx={{
                    display: 'flex',
                    gap: 0.5,
                    mb: 2,
                    p: 0.5,
                    bgcolor: '#f0ede8',
                    borderRadius: 2,
                  }}
                >
                  {(['upload', 'record'] as const).map((tab) => (
                    <Button
                      key={tab}
                      size="small"
                      onClick={() => { setSourceTab(tab); setRawFile(null); setIsTrimming(false) }}
                      startIcon={tab === 'upload' ? <UploadIcon sx={{ fontSize: 16 }} /> : <MicIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        flex: 1,
                        textTransform: 'none',
                        borderRadius: 1.5,
                        fontWeight: sourceTab === tab ? 600 : 400,
                        bgcolor: sourceTab === tab ? '#ffffff' : 'transparent',
                        color: sourceTab === tab ? '#16334a' : '#546669',
                        boxShadow: sourceTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        '&:hover': { bgcolor: sourceTab === tab ? '#ffffff' : 'rgba(22,51,74,0.05)' },
                      }}
                    >
                      {tab === 'upload' ? 'Upload file' : 'Record now'}
                    </Button>
                  ))}
                </Box>
              )}

              {/* Record tab */}
              {sourceTab === 'record' && !hasAudio && (
                <AudioRecorder
                  onRecordingComplete={handleRecordingComplete}
                  onCancel={() => setSourceTab('upload')}
                  maxDuration={300}
                  showScript={true}
                />
              )}

              {/* Upload tab — State A: No file selected yet */}
              {sourceTab === 'upload' && !rawFile && !hasAudio && (
                <Box>
                  <input
                    accept="audio/*"
                    style={{ display: 'none' }}
                    id="audio-upload"
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFilePick}
                    disabled={isUploading}
                  />
                  <label htmlFor="audio-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      disabled={isUploading}
                      fullWidth
                      sx={{
                        py: 4,
                        borderStyle: 'dashed',
                        borderColor: '#d0e3e6',
                        borderWidth: 2,
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        '&:hover': {
                          borderColor: '#16334a',
                          backgroundColor: '#f6f3ee',
                        },
                      }}
                    >
                      <UploadIcon sx={{ fontSize: 32, color: '#adcae6' }} />
                      <Typography variant="body2" sx={{ color: '#546669', textTransform: 'none' }}>
                        Click to choose an audio file
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#8a9a9d', textTransform: 'none' }}>
                        MP3, WAV, M4A, FLAC — any length, you can trim it next
                      </Typography>
                    </Button>
                  </label>
                </Box>
              )}

              {/* State B: File picked, show trimmer */}
              {rawFile && isTrimming && !hasAudio && (
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      p: 1.5,
                      mb: 1,
                      backgroundColor: '#ffffff',
                      borderRadius: 2,
                      border: '1px solid #d0e3e6',
                    }}
                  >
                    <AudioFileIcon sx={{ color: '#16334a', fontSize: 24 }} />
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: '#16334a',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '0.8rem',
                        }}
                      >
                        {rawFile.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#546669' }}>
                        {(rawFile.size / 1024 / 1024).toFixed(1)} MB — select a clip below
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={handleDiscardFile} sx={{ color: '#546669' }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <AudioTrimmer
                    file={rawFile}
                    onTrimComplete={handleTrimComplete}
                    disabled={isUploading}
                  />

                  {isUploading && (
                    <Alert
                      severity="info"
                      sx={{
                        mt: 2,
                        backgroundColor: '#e8f0fe',
                        border: '1px solid #d0e3e6',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#16334a' }}>
                        Uploading & transcribing clip...
                      </Typography>
                      <LinearProgress
                        sx={{ mt: 1, borderRadius: 1, '& .MuiLinearProgress-bar': { backgroundColor: '#16334a' } }}
                      />
                    </Alert>
                  )}
                </Box>
              )}

              {/* State C: Trimmed & uploaded */}
              {hasAudio && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    backgroundColor: '#ffffff',
                    borderRadius: 2,
                    border: '1px solid #d0e3e6',
                  }}
                >
                  <AudioFileIcon sx={{ color: '#16334a', fontSize: 28 }} />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: '#16334a',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {trainingSamples[0].name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#546669' }}>
                      {(trainingSamples[0].size / 1024 / 1024).toFixed(1)} MB
                    </Typography>
                  </Box>
                  <Chip
                    label="Ready"
                    size="small"
                    sx={{ backgroundColor: '#d0e3e6', color: '#16334a', fontWeight: 600 }}
                  />
                  <IconButton
                    size="small"
                    onClick={handleRemoveUploaded}
                    disabled={isTraining}
                    sx={{ color: '#546669' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </Box>

            {/* ── Step 2: Name the Voice ── */}
            <Box sx={{ mb: 3, opacity: hasAudio ? 1 : 0.4, pointerEvents: hasAudio ? 'auto' : 'none' }}>
              <Typography variant="subtitle2" sx={{ color: '#16334a', mb: 1.5, fontWeight: 600 }}>
                2. Name this voice
              </Typography>
              <TextField
                fullWidth
                placeholder="e.g. Grandpa Buck, Mom, Uncle Ray"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                disabled={isTraining}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#ffffff',
                    borderRadius: 2,
                    color: '#16334a',
                  },
                  '& .MuiOutlinedInput-input': {
                    color: '#16334a',
                  },
                  '& .MuiOutlinedInput-input::placeholder': {
                    color: '#8a9a9d',
                    opacity: 1,
                  },
                }}
              />
            </Box>

            {/* ── Step 3: Describe the Voice ── */}
            <Box sx={{ mb: 2, opacity: hasAudio ? 1 : 0.4, pointerEvents: hasAudio ? 'auto' : 'none' }}>
              <Typography variant="subtitle2" sx={{ color: '#16334a', mb: 1.5, fontWeight: 600 }}>
                3. Describe how they talked
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Describe their speaking style, pace, and personality. For example: 'Warm and gentle, spoke slowly with a slight southern accent, always sounded like they were smiling'"
                value={voiceDescription}
                onChange={(e) => setVoiceDescription(e.target.value)}
                disabled={isTraining}
                variant="outlined"
                sx={{
                  mb: 1.5,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#ffffff',
                    borderRadius: 2,
                    color: '#16334a',
                  },
                  '& .MuiOutlinedInput-input, & .MuiInputBase-inputMultiline': {
                    color: '#16334a',
                  },
                  '& .MuiOutlinedInput-input::placeholder, & .MuiInputBase-inputMultiline::placeholder': {
                    color: '#8a9a9d',
                    opacity: 1,
                  },
                }}
              />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {STYLE_SUGGESTIONS.map((suggestion) => (
                  <Chip
                    key={suggestion}
                    label={suggestion}
                    size="small"
                    onClick={() => handleSuggestionClick(suggestion)}
                    sx={{
                      backgroundColor: voiceDescription === suggestion ? '#16334a' : '#f6f3ee',
                      color: voiceDescription === suggestion ? '#ffffff' : '#546669',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: voiceDescription === suggestion ? '#2e4a62' : '#ebe8e3',
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* ── Creating State ── */}
            {isTraining && (
              <Alert
                severity="info"
                icon={<VoiceIcon />}
                sx={{
                  mt: 2,
                  backgroundColor: '#e8f0fe',
                  border: '1px solid #d0e3e6',
                  '& .MuiAlert-icon': { color: '#16334a' },
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#16334a' }}>
                  Creating voice profile...
                </Typography>
                <Typography variant="caption" sx={{ color: '#546669' }}>
                  Analyzing voice identity and applying style. This takes about 10-15 seconds.
                </Typography>
                <LinearProgress
                  sx={{ mt: 1, borderRadius: 1, '& .MuiLinearProgress-bar': { backgroundColor: '#16334a' } }}
                />
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {isComplete ? (
          <Box sx={{ width: '100%', display: 'flex', gap: 2 }}>
            <Button
              onClick={handleClose}
              variant="outlined"
              fullWidth
              sx={{
                py: 1.5,
                fontWeight: 600,
                color: '#16334a',
                borderColor: '#16334a',
              }}
            >
              Done
            </Button>
            <Button
              onClick={handleRecordConsent}
              variant="contained"
              fullWidth
              sx={{
                background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
                py: 1.5,
                fontWeight: 600,
              }}
            >
              Record Consent
            </Button>
          </Box>
        ) : (
          <>
            <Button onClick={handleClose} disabled={isTraining} sx={{ color: '#546669' }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              variant="contained"
              disabled={!canCreate}
              startIcon={isTraining ? <CircularProgress size={18} color="inherit" /> : <VoiceIcon />}
              sx={{
                background: canCreate
                  ? 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)'
                  : undefined,
                px: 4,
                py: 1.25,
                fontWeight: 600,
              }}
            >
              {isTraining ? 'Creating...' : 'Create Voice'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
