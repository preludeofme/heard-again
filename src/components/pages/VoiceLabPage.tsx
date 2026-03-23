import {
  Box, Typography, Card, CardContent, Button, Grid, Chip,
  IconButton, CircularProgress, TextField, Dialog, DialogTitle,
  DialogContent, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material'
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  Compare as CompareIcon,
  Close as CloseIcon,
  RecordVoiceOver as VoiceIcon,
  CheckCircle as ReadyIcon,
} from '@mui/icons-material'
import { useState, useEffect, useRef } from 'react'
import { VoiceTrainingModal } from '@/components/audio/VoiceTrainingModal'
import { useVoiceLabController } from '@/controllers'

interface VoiceLabPageProps {}

export function VoiceLabPage({}: VoiceLabPageProps) {
  const {
    voiceModels,
    isUploading,
    showRecordingModal,
    trainingJob,
    isTraining,
    trainingSamples,
    toggleRecordingModal,
    uploadTrainingSample,
    removeTrainingSample,
    startVoiceTraining,
    synthesizeSpeech,
    loadVoiceModels,
    deleteVoiceProfile,
  } = useVoiceLabController()

  // ── Local state ──
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null)
  const [testText, setTestText] = useState('')
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Compare dialog state
  const [showCompare, setShowCompare] = useState(false)
  const [compareA, setCompareA] = useState<string>('')
  const [compareB, setCompareB] = useState<string>('')
  const [compareText, setCompareText] = useState('')
  const [isComparing, setIsComparing] = useState(false)
  const [compareResults, setCompareResults] = useState<{ audioA: string | null; audioB: string | null } | null>(null)

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Load voices on mount
  useEffect(() => {
    loadVoiceModels()
  }, [loadVoiceModels])

  // Auto-select first voice if none selected
  useEffect(() => {
    if (!selectedVoiceId && voiceModels.length > 0) {
      setSelectedVoiceId(voiceModels[0].id)
    }
  }, [voiceModels, selectedVoiceId])

  const selectedVoice = voiceModels.find(m => m.id === selectedVoiceId)

  // ── Play test audio ──
  const handlePlayTest = async () => {
    if (!selectedVoiceId || !testText.trim()) return

    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setPlayingAudioUrl(null)
    }

    setIsSynthesizing(true)
    try {
      const audioUrl = await synthesizeSpeech(selectedVoiceId, testText.trim())
      setPlayingAudioUrl(audioUrl)
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.onended = () => {
        setPlayingAudioUrl(null)
        audioRef.current = null
      }
      audio.play()
    } catch (err) {
      console.error('Synthesis failed:', err)
    } finally {
      setIsSynthesizing(false)
    }
  }

  const handleStopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setPlayingAudioUrl(null)
    }
  }

  // ── Compare voices ──
  const handleCompare = async () => {
    if (!compareA || !compareB || !compareText.trim()) return
    setCompareResults(null)
    setIsComparing(true)
    try {
      const [audioA, audioB] = await Promise.all([
        synthesizeSpeech(compareA, compareText.trim()),
        synthesizeSpeech(compareB, compareText.trim()),
      ])
      setCompareResults({ audioA, audioB })
    } catch (err) {
      console.error('Compare failed:', err)
      setCompareResults({ audioA: null, audioB: null })
    } finally {
      setIsComparing(false)
    }
  }

  // ── Delete voice ──
  const handleDelete = async (profileId: string) => {
    await deleteVoiceProfile(profileId)
    setDeleteConfirmId(null)
    if (selectedVoiceId === profileId) {
      setSelectedVoiceId(null)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4', px: { xs: 3, md: 8 }, py: 6 }}>
      <Grid container spacing={4}>

        {/* ════════ Left Column — Voice Lab ════════ */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Box sx={{ backgroundColor: '#ffffff', borderRadius: 4, p: 4, height: '100%' }}>

            {/* Header */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h4" className="serif-font" sx={{ color: '#16334a', mb: 0.5 }}>
                Voice Lab
              </Typography>
              <Typography variant="body2" sx={{ color: '#546669' }}>
                Create, test, and compare voice clones
              </Typography>
            </Box>

            {/* Create New Voice Button */}
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              onClick={toggleRecordingModal}
              sx={{
                background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
                py: 2,
                fontSize: '1.1rem',
                fontWeight: 600,
                mb: 4,
              }}
            >
              Create New Voice
            </Button>

            {/* ── Test Selected Voice ── */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ color: '#16334a', mb: 2, fontWeight: 600 }}>
                Test a Voice
              </Typography>

              {selectedVoice ? (
                <Box>
                  <Chip
                    icon={<VoiceIcon sx={{ fontSize: 16 }} />}
                    label={selectedVoice.displayName || selectedVoice.name}
                    sx={{
                      mb: 2,
                      backgroundColor: '#d0e3e6',
                      color: '#16334a',
                      fontWeight: 600,
                    }}
                  />
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Type something to hear this voice say..."
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={
                        isSynthesizing ? <CircularProgress size={18} color="inherit" /> :
                        playingAudioUrl ? <StopIcon /> : <PlayIcon />
                      }
                      onClick={playingAudioUrl ? handleStopAudio : handlePlayTest}
                      disabled={!testText.trim() || isSynthesizing}
                      sx={{
                        background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
                        fontWeight: 600,
                      }}
                    >
                      {isSynthesizing ? 'Generating...' : playingAudioUrl ? 'Stop' : 'Play Voice'}
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    backgroundColor: '#f6f3ee',
                    borderRadius: 2,
                    border: '1px dashed #d0e3e6',
                  }}
                >
                  <VoiceIcon sx={{ fontSize: 40, color: '#adcae6', mb: 1 }} />
                  <Typography variant="body2" sx={{ color: '#546669' }}>
                    {voiceModels.length === 0
                      ? 'Create your first voice to get started'
                      : 'Select a voice from the list to test it'}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* ── Compare Voices Button ── */}
            {voiceModels.length >= 2 && (
              <Button
                fullWidth
                variant="outlined"
                startIcon={<CompareIcon />}
                onClick={() => {
                  setCompareA(voiceModels[0]?.id || '')
                  setCompareB(voiceModels[1]?.id || '')
                  setCompareText('')
                  setCompareResults(null)
                  setShowCompare(true)
                }}
                sx={{
                  borderColor: '#d0e3e6',
                  color: '#16334a',
                  py: 1.5,
                  fontWeight: 600,
                  '&:hover': { borderColor: '#16334a', backgroundColor: '#f6f3ee' },
                }}
              >
                Compare Voices
              </Button>
            )}
          </Box>
        </Grid>

        {/* ════════ Right Column — Your Voices ════════ */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Box sx={{ backgroundColor: '#ffffff', borderRadius: 4, p: 4, height: '100%' }}>

            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box>
                <Typography variant="h4" className="serif-font" sx={{ color: '#16334a', mb: 0.5 }}>
                  Your Voices
                </Typography>
                <Typography variant="body2" sx={{ color: '#546669' }}>
                  {voiceModels.length} voice{voiceModels.length !== 1 ? 's' : ''} created
                </Typography>
              </Box>
              <Chip
                label={`${voiceModels.length} voice${voiceModels.length !== 1 ? 's' : ''}`}
                sx={{ backgroundColor: '#d0e3e6', color: '#16334a', fontWeight: 600 }}
              />
            </Box>

            {/* Voice List */}
            {voiceModels.length === 0 ? (
              <Box
                sx={{
                  py: 8,
                  textAlign: 'center',
                  backgroundColor: '#f6f3ee',
                  borderRadius: 3,
                  border: '1px dashed #d0e3e6',
                }}
              >
                <VoiceIcon sx={{ fontSize: 56, color: '#adcae6', mb: 2 }} />
                <Typography variant="h6" className="serif-font" sx={{ color: '#16334a', mb: 1 }}>
                  No voices yet
                </Typography>
                <Typography variant="body2" sx={{ color: '#546669', mb: 3 }}>
                  Create your first voice clone to get started
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={toggleRecordingModal}
                  sx={{
                    background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
                    fontWeight: 600,
                  }}
                >
                  Create New Voice
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {voiceModels.map((model) => {
                  const isSelected = selectedVoiceId === model.id
                  const isDeleting = deleteConfirmId === model.id

                  return (
                    <Card
                      key={model.id}
                      onClick={() => setSelectedVoiceId(model.id)}
                      sx={{
                        backgroundColor: isSelected ? '#edf4f7' : '#f6f3ee',
                        border: isSelected ? '2px solid #16334a' : '2px solid transparent',
                        boxShadow: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          backgroundColor: isSelected ? '#edf4f7' : '#ebe8e3',
                          transform: 'none',
                        },
                      }}
                    >
                      <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, '&:last-child': { pb: 2.5 } }}>
                        {/* Avatar / icon */}
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            backgroundColor: isSelected ? '#16334a' : '#d0e3e6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <VoiceIcon sx={{ color: isSelected ? '#ffffff' : '#16334a', fontSize: 22 }} />
                        </Box>

                        {/* Info */}
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography
                            variant="body1"
                            sx={{
                              fontWeight: 600,
                              color: '#16334a',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {model.displayName || model.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#546669' }}>
                            Created {new Date(model.createdAt).toLocaleDateString()}
                          </Typography>
                        </Box>

                        {/* Status */}
                        <ReadyIcon sx={{ color: '#4caf50', fontSize: 20, flexShrink: 0 }} />

                        {/* Delete */}
                        {isDeleting ? (
                          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="small"
                              variant="contained"
                              color="error"
                              onClick={() => handleDelete(model.id)}
                              sx={{ minWidth: 0, px: 1.5, py: 0.5, fontSize: '0.75rem' }}
                            >
                              Delete
                            </Button>
                            <Button
                              size="small"
                              onClick={() => setDeleteConfirmId(null)}
                              sx={{ minWidth: 0, px: 1, py: 0.5, fontSize: '0.75rem', color: '#546669' }}
                            >
                              Cancel
                            </Button>
                          </Box>
                        ) : (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirmId(model.id)
                            }}
                            sx={{ color: '#8a9a9d', '&:hover': { color: '#dc2626' }, flexShrink: 0 }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </Box>
            )}
          </Box>
        </Grid>
      </Grid>

      {/* ════════ Voice Training Modal ════════ */}
      <VoiceTrainingModal
        open={showRecordingModal}
        onClose={toggleRecordingModal}
        trainingSamples={trainingSamples}
        onUploadSample={uploadTrainingSample}
        onRemoveSample={removeTrainingSample}
        onCreateVoice={startVoiceTraining}
        isUploading={isUploading}
        isTraining={isTraining}
        trainingJob={trainingJob}
      />

      {/* ════════ Compare Voices Dialog ════════ */}
      <Dialog
        open={showCompare}
        onClose={() => { setShowCompare(false); setCompareResults(null) }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, backgroundColor: '#fcf9f4' } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h5" className="serif-font" sx={{ color: '#16334a', fontWeight: 600 }}>
              Compare Voices
            </Typography>
            <IconButton onClick={() => { setShowCompare(false); setCompareResults(null) }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#546669', mb: 3 }}>
            Compare two voice profiles by generating the same text with each
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Text to compare"
            value={compareText}
            onChange={(e) => setCompareText(e.target.value)}
            placeholder="Enter text both voices will say..."
            sx={{ mb: 3 }}
          />

          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Voice A</InputLabel>
              <Select
                value={compareA}
                label="Voice A"
                onChange={(e) => setCompareA(e.target.value)}
              >
                {voiceModels.map((m) => (
                  <MenuItem key={m.id} value={m.id}>{m.displayName || m.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Voice B</InputLabel>
              <Select
                value={compareB}
                label="Voice B"
                onChange={(e) => setCompareB(e.target.value)}
              >
                {voiceModels.map((m) => (
                  <MenuItem key={m.id} value={m.id}>{m.displayName || m.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Button
            variant="contained"
            fullWidth
            onClick={handleCompare}
            disabled={!compareText.trim() || !compareA || !compareB || isComparing}
            startIcon={isComparing ? <CircularProgress size={18} color="inherit" /> : undefined}
            sx={{
              background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
              py: 1.5,
              fontWeight: 600,
              mb: 2,
            }}
          >
            {isComparing ? 'Generating...' : 'Generate Comparison'}
          </Button>

          {/* Results */}
          {compareResults && (
            <Box sx={{ p: 2, backgroundColor: '#ffffff', borderRadius: 2, border: '1px solid #d0e3e6' }}>
              <Typography variant="subtitle2" sx={{ color: '#16334a', mb: 2 }}>
                Results
              </Typography>

              {compareResults.audioA && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ color: '#546669', fontWeight: 600, mb: 0.5, display: 'block' }}>
                    Voice A: {voiceModels.find(m => m.id === compareA)?.displayName || compareA}
                  </Typography>
                  <audio controls src={compareResults.audioA} style={{ width: '100%' }} />
                </Box>
              )}

              {compareResults.audioB && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" sx={{ color: '#546669', fontWeight: 600, mb: 0.5, display: 'block' }}>
                    Voice B: {voiceModels.find(m => m.id === compareB)?.displayName || compareB}
                  </Typography>
                  <audio controls src={compareResults.audioB} style={{ width: '100%' }} />
                </Box>
              )}

              {!compareResults.audioA && !compareResults.audioB && (
                <Typography variant="body2" color="error">
                  Failed to generate comparison audio. Make sure the TTS service is running.
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}
