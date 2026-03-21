import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Mic as MicIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  Schedule as ScheduleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material'

interface VoiceTrainingModalProps {
  open: boolean
  onClose: () => void
  trainingSamples: File[]
  onUploadSample: (file: File) => Promise<void>
  onRemoveSample: (index: number) => void
  onStartTraining: (modelName: string, language: string) => Promise<void>
  isUploading: boolean
  isTraining: boolean
  trainingJob: any
  preprocessingStatus: string
  asrStatus: string
  queuePosition: number | null
  estimatedStartTime: Date | null
  onPreprocessSamples: (options: { noiseReduction: boolean; voiceSeparation: boolean }) => Promise<void>
  onRunASR: (language: string) => Promise<void>
  onCancelTrainingJob: (jobId: string) => Promise<void>
}

export function VoiceTrainingModal({
  open,
  onClose,
  trainingSamples,
  onUploadSample,
  onRemoveSample,
  onStartTraining,
  isUploading,
  isTraining,
  trainingJob,
  preprocessingStatus,
  asrStatus,
  queuePosition,
  estimatedStartTime,
  onPreprocessSamples,
  onRunASR,
  onCancelTrainingJob,
}: VoiceTrainingModalProps) {
  const [modelName, setModelName] = useState('')
  const [language, setLanguage] = useState('en')
  const [noiseReduction, setNoiseReduction] = useState(true)
  const [voiceSeparation, setVoiceSeparation] = useState(true)
  const [advancedSettings, setAdvancedSettings] = useState(false)

  // Generate default model name on mount
  useEffect(() => {
    const defaultName = `Voice Model ${new Date().toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })}`
    setModelName(defaultName)
  }, [])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      await onUploadSample(file)
    }
  }

  const handleStartTraining = async () => {
    if (!modelName.trim()) return
    await onStartTraining(modelName, language)
    setModelName('')
  }

  const handlePreprocess = async () => {
    await onPreprocessSamples({ noiseReduction, voiceSeparation })
  }

  const handleRunASR = async () => {
    await onRunASR(language)
  }

  const getStageLabel = (stage: string) => {
    const stageLabels: Record<string, string> = {
      queued: 'Queued',
      slicing: 'Slicing audio segments...',
      enhancement: 'Enhancing audio quality...',
      asr_transcription: 'Converting speech to text...',
      generating_list: 'Preparing training data...',
      training: 'Training voice model...',
      validation: 'Validating model...',
      completed: 'Completed',
    }
    return stageLabels[stage] || stage
  }

  const formatTime = (date: Date | null) => {
    if (!date) return 'Unknown'
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5">Train Voice Clone</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {trainingJob ? (
          <Box>
            <Typography variant="h6" gutterBottom>
              Training in Progress
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Model: {modelName}
            </Typography>
            
            {/* Queue Position */}
            {queuePosition && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <ScheduleIcon />
                  <Typography variant="body2">
                    Queue Position: {queuePosition} • Estimated start: {formatTime(estimatedStartTime)}
                  </Typography>
                </Box>
              </Alert>
            )}

            <Box mb={2}>
              <LinearProgress 
                variant="determinate" 
                value={trainingJob.progress} 
                sx={{ height: 10, borderRadius: 5 }}
              />
              <Typography variant="body2" sx={{ mt: 1 }}>
                {trainingJob.progress}% - {getStageLabel(trainingJob.currentStage)}
              </Typography>
            </Box>

            {/* Pipeline Progress Details */}
            <Accordion sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Pipeline Progress</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box display="flex" flexDirection="column" gap={2}>
                  {/* Audio Slicing */}
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Audio Slicing: {trainingJob.currentStage === 'slicing' ? 'Processing...' : 
                                   ['training', 'validation', 'completed'].includes(trainingJob.currentStage) ? 'Completed' : 'Pending'}
                    </Typography>
                    <LinearProgress 
                      variant={trainingJob.currentStage === 'slicing' ? 'indeterminate' : 'determinate'}
                      value={['training', 'validation', 'completed'].includes(trainingJob.currentStage) ? 100 : 0}
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                  </Box>
                  
                  {/* Voice Enhancement */}
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Voice Enhancement: {trainingJob.currentStage === 'enhancement' ? 'Processing...' : 
                                       ['training', 'validation', 'completed'].includes(trainingJob.currentStage) ? 'Completed' : 'Pending'}
                    </Typography>
                    <LinearProgress 
                      variant={trainingJob.currentStage === 'enhancement' ? 'indeterminate' : 'determinate'}
                      value={['training', 'validation', 'completed'].includes(trainingJob.currentStage) ? 100 : 0}
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                  </Box>
                  
                  {/* ASR Transcription */}
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Speech-to-Text: {trainingJob.currentStage === 'asr_transcription' ? 'Processing...' : 
                                      ['training', 'validation', 'completed'].includes(trainingJob.currentStage) ? 'Completed' : 'Pending'}
                    </Typography>
                    <LinearProgress 
                      variant={trainingJob.currentStage === 'asr_transcription' ? 'indeterminate' : 'determinate'}
                      value={['training', 'validation', 'completed'].includes(trainingJob.currentStage) ? 100 : 0}
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                  </Box>
                  
                  {/* List File Generation */}
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Training Data Prep: {trainingJob.currentStage === 'generating_list' ? 'Processing...' : 
                                         ['training', 'validation', 'completed'].includes(trainingJob.currentStage) ? 'Completed' : 'Pending'}
                    </Typography>
                    <LinearProgress 
                      variant={trainingJob.currentStage === 'generating_list' ? 'indeterminate' : 'determinate'}
                      value={['training', 'validation', 'completed'].includes(trainingJob.currentStage) ? 100 : 0}
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                  </Box>
                  
                  {/* Model Training */}
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Model Training: {trainingJob.currentStage === 'training' ? 'Processing...' : 
                                     trainingJob.currentStage === 'completed' ? 'Completed' : 'Pending'}
                    </Typography>
                    <LinearProgress 
                      variant={trainingJob.currentStage === 'training' ? 'determinate' : 'determinate'}
                      value={trainingJob.currentStage === 'training' ? trainingJob.progress : 
                             trainingJob.currentStage === 'completed' ? 100 : 0}
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>

            {trainingJob.error && (
              <Typography color="error" variant="body2">
                Error: {trainingJob.error}
              </Typography>
            )}

            <Box mt={2}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<CancelIcon />}
                onClick={() => onCancelTrainingJob(trainingJob.id)}
                disabled={trainingJob.status === 'processing'}
              >
                Cancel Training
              </Button>
            </Box>
          </Box>
        ) : (
          <Box>
            <Typography variant="body1" gutterBottom>
              Upload audio samples to create a voice clone. We recommend at least 1 minute of clear audio.
            </Typography>

            {/* Upload Section */}
            <Box mb={3}>
              <input
                accept="audio/*"
                style={{ display: 'none' }}
                id="audio-upload"
                type="file"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <label htmlFor="audio-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadIcon />}
                  disabled={isUploading}
                  fullWidth
                  sx={{ py: 2, borderStyle: 'dashed' }}
                >
                  {isUploading ? 'Uploading...' : 'Upload Audio Sample'}
                </Button>
              </label>
            </Box>

            {/* Sample List */}
            {trainingSamples.length > 0 && (
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  Uploaded Samples ({trainingSamples.length})
                </Typography>
                <List dense>
                  {trainingSamples.map((file, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={file.name}
                        secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => onRemoveSample(index)}
                          disabled={isTraining}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Model Configuration */}
            {trainingSamples.length > 0 && (
              <Box mb={3}>
                <TextField
                  fullWidth
                  label="Model Name"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  margin="normal"
                  disabled={isTraining}
                  helperText="Default name generated automatically"
                />
                <FormControl fullWidth margin="normal">
                  <InputLabel>Language</InputLabel>
                  <Select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={isTraining}
                  >
                    <MenuItem value="en">English</MenuItem>
                    <MenuItem value="zh">Chinese</MenuItem>
                    <MenuItem value="ja">Japanese</MenuItem>
                    <MenuItem value="ko">Korean</MenuItem>
                    <MenuItem value="yue">Cantonese</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}

            {/* Advanced Settings */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={1}>
                  <SettingsIcon />
                  <Typography variant="subtitle2">Advanced Settings</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box display="flex" flexDirection="column" gap={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={noiseReduction}
                        onChange={(e) => setNoiseReduction(e.target.checked)}
                        disabled={isTraining}
                      />
                    }
                    label="Apply Noise Reduction"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={voiceSeparation}
                        onChange={(e) => setVoiceSeparation(e.target.checked)}
                        disabled={isTraining}
                      />
                    }
                    label="Voice Separation (UVR5)"
                  />
                  <Divider />
                  <Button
                    variant="outlined"
                    onClick={handlePreprocess}
                    disabled={isTraining || preprocessingStatus === 'processing'}
                    fullWidth
                  >
                    Preprocess Audio
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleRunASR}
                    disabled={isTraining || asrStatus === 'processing'}
                    fullWidth
                  >
                    Run Speech-to-Text
                  </Button>
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Tips */}
            <Box mt={3}>
              <Typography variant="subtitle2" gutterBottom>
                Tips for best results:
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                <Chip label="Clear audio quality" size="small" />
                <Chip label="Minimal background noise" size="small" />
                <Chip label="Consistent speaking style" size="small" />
                <Chip label="1+ minute total duration" size="small" />
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {!trainingJob && (
          <>
            <Button onClick={onClose} disabled={isTraining}>
              Cancel
            </Button>
            <Button
              onClick={handleStartTraining}
              variant="contained"
              disabled={!modelName.trim() || trainingSamples.length === 0 || isTraining}
              startIcon={<MicIcon />}
            >
              {isTraining ? 'Starting...' : 'Start Training'}
            </Button>
          </>
        )}
        {trainingJob && trainingJob.status === 'completed' && (
          <Button onClick={onClose} variant="contained">
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
