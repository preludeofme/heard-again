import {
  Box, Typography, Card, CardContent, Button, Grid, Chip,
  IconButton, CircularProgress, TextField, Dialog, DialogTitle,
  DialogContent, Select, MenuItem, FormControl, InputLabel,
  Avatar, Tooltip, DialogActions
} from '@mui/material'
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  Compare as CompareIcon,
  Close as CloseIcon,
  RecordVoiceOver as VoiceIcon,
  Lock as LockIcon,
} from '@mui/icons-material'
import { useState, useEffect, useRef } from 'react'
import { VoiceTrainingModal } from '@/components/audio/VoiceTrainingModal'
import { VoiceConsentModal } from '@/components/audio/VoiceConsentModal'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'
import type { VoiceModel } from '@/types'
import { ProfileColors } from '@/components/profile/ProfileConstants'

interface VoiceLabPageProps {
  voiceModels: VoiceModel[]
  controller: {
    isUploading: boolean
    showRecordingModal: boolean
    trainingJob: { status?: string; modelId?: string } | null
    isTraining: boolean
    trainingSamples: any[]
    toggleRecordingModal: () => void
    uploadTrainingSample: (file: File) => Promise<void>
    removeTrainingSample: (index: number) => void
    startVoiceTraining: (modelName: string, language: string, styleInstruct?: string) => Promise<void>
    synthesizeSpeech: (voiceId: string, text: string) => Promise<string>
    loadVoiceModels: () => Promise<void>
    deleteVoiceProfile: (profileId: string) => Promise<void>
    refreshData: () => Promise<void>
  }
}

export function VoiceLabPage({ voiceModels, controller }: VoiceLabPageProps) {
  const {
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
    deleteVoiceProfile,
    refreshData,
  } = controller

  const { selectedFamilyMember } = useSelectedFamilyMember()
  const memberName = selectedFamilyMember?.firstName || 'this person'
  const hasSelectedPerson = Boolean(selectedFamilyMember?.id)

  // ── Local state ──
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null)
  const [testText, setTestText] = useState(`Hello, it's so good to be remembered. I'm glad we're keeping these memories alive together.`)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Compare dialog state
  const [showCompare, setShowCompare] = useState(false)
  const [compareA, setCompareA] = useState<string>('')
  const [compareB, setCompareB] = useState<string>('')
  const [compareText, setCompareText] = useState(`This is how I sound in the digital archive.`)
  const [isComparing, setIsComparing] = useState(false)
  const [compareResults, setCompareResults] = useState<{ audioA: string | null; audioB: string | null } | null>(null)

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Consent modal state
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [consentPersonId, setConsentPersonId] = useState<string>('')
  const [consentPersonName, setConsentPersonName] = useState<string>('')
  const [consentVoiceProfileId, setConsentVoiceProfileId] = useState<string | undefined>()

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
    } catch (err: any) {
      console.error('Synthesis failed:', err)
      const errorMsg = err.message || ''
      if (errorMsg.includes('consent') || errorMsg.includes('blocked')) {
        const person = selectedVoice?.person || selectedFamilyMember
        if (person) {
          setConsentPersonId(person.id)
          setConsentPersonName(person.firstName + (person.lastName ? ` ${person.lastName}` : ''))
          setConsentVoiceProfileId(selectedVoiceId)
          setShowConsentModal(true)
        }
      }
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

  // ── Create voice with auto-refresh ──
  const handleCreateVoice = async (modelName: string, language: string, styleInstruct?: string) => {
    if (!selectedFamilyMember?.id) {
      throw new Error('Select a family member before creating a voice.')
    }
    await startVoiceTraining(modelName, language, styleInstruct, selectedFamilyMember.id)
    await refreshData()
  }

  const handleConsentRecorded = () => {
    setShowConsentModal(false)
    refreshData()
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: ProfileColors.surface, px: { xs: 2, md: 8 }, py: { xs: 4, md: 8 } }}>
      <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
        {/* Editorial Header */}
        <Box sx={{ mb: 6, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'flex-end' }, gap: 3 }}>
          <Box>
            <Typography
              sx={{
                fontFamily: 'var(--font-manrope), sans-serif',
                fontSize: '0.85rem',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: ProfileColors.onSurfaceVariant,
                mb: 1
              }}
            >
              The Living Voice
            </Typography>
            <Typography 
              variant="h2" 
              className="serif-font" 
              sx={{ 
                color: ProfileColors.primary, 
                fontWeight: 700,
                fontSize: { xs: '2.5rem', md: '3.5rem' },
                lineHeight: 1,
                fontStyle: 'italic'
              }}
            >
              Hear them tell it
            </Typography>
            <Typography variant="body1" sx={{ color: ProfileColors.onSurfaceVariant, mt: 2, maxWidth: 550, fontFamily: 'var(--font-newsreader), serif', fontSize: '1.15rem' }}>
              We believe every voice is a fingerprint of the soul. Archive their warmth and wisdom so future generations can truly listen.
            </Typography>
          </Box>
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={toggleRecordingModal}
            disabled={!hasSelectedPerson}
            sx={{
              backgroundColor: ProfileColors.primary,
              borderRadius: '999px',
              py: 1.5,
              px: 3,
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': { backgroundColor: ProfileColors.primaryContainer, color: ProfileColors.onPrimaryContainer }
            }}
          >
            {hasSelectedPerson ? `Add ${memberName}'s Voice` : 'Select a person to begin'}
          </Button>
        </Box>

        <Grid container spacing={5}>
          {/* Voice Collection */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <Box sx={{ backgroundColor: ProfileColors.surfaceContainerLowest, borderRadius: 6, p: 4, boxShadow: '0 4px 40px rgba(0,0,0,0.04)', border: `1px solid ${ProfileColors.outlineVariant}15` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h5" className="serif-font" sx={{ color: ProfileColors.primary, fontWeight: 700 }}>
                  Voice Collection
                </Typography>
                <Chip
                  label={`${voiceModels.length} voices archived`}
                  sx={{ backgroundColor: ProfileColors.secondaryContainer, color: ProfileColors.onSecondaryContainer, fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}
                />
              </Box>

              {voiceModels.length === 0 ? (
                <Box sx={{ py: 10, textAlign: 'center', backgroundColor: ProfileColors.surfaceContainerLow, borderRadius: 4, border: `2px dashed ${ProfileColors.outlineVariant}30` }}>
                  <VoiceIcon sx={{ fontSize: 56, color: ProfileColors.outlineVariant, mb: 2, opacity: 0.5 }} />
                  <Typography variant="h6" className="serif-font" sx={{ color: ProfileColors.primary, mb: 1 }}>
                    Silence is waiting to be filled
                  </Typography>
                  <Typography variant="body2" sx={{ color: ProfileColors.onSurfaceVariant, mb: 4 }}>
                    Start by teaching the archive {memberName}'s unique voice.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {voiceModels.map((model: VoiceModel) => {
                    const isSelected = selectedVoiceId === model.id
                    const isDeleting = deleteConfirmId === model.id

                    return (
                      <Card
                        key={model.id}
                        onClick={() => setSelectedVoiceId(model.id)}
                        sx={{
                          backgroundColor: isSelected ? ProfileColors.surfaceContainerLow : 'transparent',
                          border: `1px solid ${isSelected ? ProfileColors.primary + '30' : ProfileColors.outlineVariant + '15'}`,
                          boxShadow: isSelected ? '0 4px 20px rgba(0,0,0,0.06)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          borderRadius: 4,
                          '&:hover': {
                            backgroundColor: isSelected ? ProfileColors.surfaceContainerLow : ProfileColors.surfaceContainerLowest,
                            transform: 'translateX(4px)',
                            borderColor: ProfileColors.primary + '20',
                          },
                        }}
                      >
                        <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 3, '&:last-child': { pb: 3 } }}>
                          <Avatar
                            src={model.person?.avatarAssetId ? `/api/assets/serve/${model.person.avatarAssetId}` : undefined}
                            sx={{
                              width: 56,
                              height: 56,
                              backgroundColor: isSelected ? ProfileColors.primary : ProfileColors.surfaceContainerHigh,
                              color: isSelected ? '#fff' : ProfileColors.primary,
                              border: `2px solid ${isSelected ? ProfileColors.primary : 'transparent'}`,
                              boxShadow: isSelected ? 2 : 0
                            }}
                          >
                            <VoiceIcon />
                          </Avatar>

                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography variant="h6" className="serif-font" sx={{ fontWeight: 700, color: ProfileColors.primary }}>
                              {model.displayName || model.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: ProfileColors.onSurfaceVariant, fontWeight: 500 }}>
                              Created {new Date(model.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            {model.hasConsent !== true && (
                              <Tooltip title="Needs recorded consent">
                                <IconButton 
                                  size="small" 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setConsentPersonId(model.person?.id || '')
                                    setConsentPersonName(model.person?.firstName || '')
                                    setConsentVoiceProfileId(model.id)
                                    setShowConsentModal(true)
                                  }}
                                  sx={{ color: '#b45309', bgcolor: '#fef3c7' }}
                                >
                                  <LockIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {isDeleting ? (
                              <Button
                                size="small"
                                variant="contained"
                                color="error"
                                onClick={(e) => { e.stopPropagation(); handleDelete(model.id); }}
                                sx={{ minWidth: 0, px: 1 }}
                              >
                                Del
                              </Button>
                            ) : (
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteConfirmId(model.id)
                                }}
                                sx={{ color: ProfileColors.onSurfaceVariant, '&:hover': { color: '#dc2626', bgcolor: '#fee2e2' } }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    )
                  })}
                </Box>
              )}
            </Box>
          </Grid>

          {/* Listening Room */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Box sx={{ backgroundColor: ProfileColors.surfaceContainerLowest, borderRadius: 6, p: 4, boxShadow: '0 4px 40px rgba(0,0,0,0.04)', border: `1px solid ${ProfileColors.outlineVariant}15` }}>
                <Typography variant="h5" className="serif-font" sx={{ color: ProfileColors.primary, fontWeight: 700, mb: 3 }}>
                  Listening Room
                </Typography>

                {selectedVoice ? (
                  <Box>
                    <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, p: 2, backgroundColor: ProfileColors.surfaceContainerLow, borderRadius: 3 }}>
                      <VoiceIcon sx={{ color: ProfileColors.primary }} />
                      <Typography sx={{ fontWeight: 600, color: ProfileColors.primary }}>
                        Listening to {selectedVoice.displayName || selectedVoice.name}
                      </Typography>
                    </Box>

                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      placeholder="Type a greeting or a memory..."
                      value={testText}
                      onChange={(e) => setTestText(e.target.value)}
                      variant="outlined"
                      sx={{ 
                        mb: 3,
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: '#fff',
                          borderRadius: 3,
                          fontFamily: 'var(--font-newsreader), serif',
                          fontSize: '1.1rem'
                        }
                      }}
                    />

                    {playingAudioUrl && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: 40, mb: 3, px: 2 }}>
                        {[...Array(20)].map((_, i) => (
                          <Box 
                            key={i} 
                            sx={{ 
                              width: 3, 
                              height: 10 + Math.random() * 20, 
                              bgcolor: ProfileColors.primary, 
                              borderRadius: 1,
                              animation: 'pulse 1s infinite ease-in-out',
                              animationDelay: `${i * 0.05}s`,
                              '@keyframes pulse': {
                                '0%, 100%': { transform: 'scaleY(1)' },
                                '50%': { transform: 'scaleY(1.5)' }
                              }
                            }} 
                          />
                        ))}
                      </Box>
                    )}

                    <Button
                      variant="contained"
                      fullWidth
                      size="large"
                      startIcon={isSynthesizing ? <CircularProgress size={20} color="inherit" /> : playingAudioUrl ? <StopIcon /> : <PlayIcon />}
                      onClick={playingAudioUrl ? handleStopAudio : handlePlayTest}
                      disabled={!testText.trim() || isSynthesizing}
                      sx={{
                        backgroundColor: ProfileColors.primary,
                        borderRadius: '999px',
                        py: 2,
                        fontWeight: 600,
                        '&:hover': { backgroundColor: ProfileColors.primaryContainer }
                      }}
                    >
                      {isSynthesizing ? 'Preparing Voice...' : playingAudioUrl ? 'Silence' : 'Hear the Voice'}
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ p: 4, textAlign: 'center', backgroundColor: ProfileColors.surfaceContainerLow, borderRadius: 4, border: `1px dashed ${ProfileColors.outlineVariant}20` }}>
                    <Typography variant="body2" sx={{ color: ProfileColors.onSurfaceVariant }}>
                      Select a voice from your collection to step into the listening room.
                    </Typography>
                  </Box>
                )}
              </Box>

              {voiceModels.length >= 2 && (
                <Card 
                  onClick={() => {
                    setCompareA(voiceModels[0]?.id || '')
                    setCompareB(voiceModels[1]?.id || '')
                    setCompareResults(null)
                    setShowCompare(true)
                  }}
                  sx={{ 
                    borderRadius: 6, 
                    cursor: 'pointer',
                    backgroundColor: ProfileColors.surfaceContainerLow,
                    border: `1px solid ${ProfileColors.outlineVariant}10`,
                    '&:hover': { borderColor: ProfileColors.primary + '30', bgcolor: ProfileColors.surfaceContainerLowest }
                  }}
                >
                  <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CompareIcon sx={{ color: ProfileColors.primary }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 700, color: ProfileColors.primary }}>Compare nuances</Typography>
                      <Typography variant="caption" sx={{ color: ProfileColors.onSurfaceVariant }}>Listen to two versions side-by-side</Typography>
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Box>
          </Grid>
        </Grid>
      </Box>

      <VoiceTrainingModal
        open={showRecordingModal}
        onClose={toggleRecordingModal}
        trainingSamples={trainingSamples}
        onUploadSample={uploadTrainingSample}
        onRemoveSample={removeTrainingSample}
        onCreateVoice={handleCreateVoice}
        isUploading={isUploading}
        isTraining={isTraining}
        trainingJob={trainingJob}
      />

      <VoiceConsentModal
        open={showConsentModal}
        onClose={() => setShowConsentModal(false)}
        personId={consentPersonId}
        personName={consentPersonName}
        voiceProfileId={consentVoiceProfileId}
        onConsentRecorded={handleConsentRecorded}
      />

      <Dialog
        open={showCompare}
        onClose={() => { setShowCompare(false); setCompareResults(null) }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, p: 2 } }}
      >
        <DialogTitle sx={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 700 }}>
          Nuance Comparison
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 3, color: ProfileColors.onSurfaceVariant }}>
            Sometimes the smallest change in training samples makes a big difference. Hear them side-by-side.
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={2}
            label="What should they say?"
            value={compareText}
            onChange={(e) => setCompareText(e.target.value)}
            sx={{ mb: 3 }}
          />

          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>First Voice</InputLabel>
              <Select value={compareA} label="First Voice" onChange={(e) => setCompareA(e.target.value)}>
                {voiceModels.map((m: VoiceModel) => (
                  <MenuItem key={m.id} value={m.id}>{m.displayName || m.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Second Voice</InputLabel>
              <Select value={compareB} label="Second Voice" onChange={(e) => setCompareB(e.target.value)}>
                {voiceModels.map((m: VoiceModel) => (
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
            sx={{ borderRadius: '999px', py: 1.5, bgcolor: ProfileColors.primary }}
          >
            {isComparing ? 'Preparing comparison...' : 'Generate side-by-side'}
          </Button>

          {compareResults && (
            <Box sx={{ mt: 3, p: 2, bgcolor: ProfileColors.surfaceContainerLow, borderRadius: 3 }}>
              {compareResults.audioA && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>
                    {voiceModels.find(m => m.id === compareA)?.displayName}
                  </Typography>
                  <audio controls src={compareResults.audioA} style={{ width: '100%', height: 36 }} />
                </Box>
              )}
              {compareResults.audioB && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>
                    {voiceModels.find(m => m.id === compareB)?.displayName}
                  </Typography>
                  <audio controls src={compareResults.audioB} style={{ width: '100%', height: 36 }} />
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCompare(false)} sx={{ color: ProfileColors.onSurfaceVariant }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
