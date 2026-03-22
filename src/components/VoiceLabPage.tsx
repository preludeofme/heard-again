import { Box, Typography, Card, CardContent, Button, Grid, Chip, IconButton, LinearProgress, CircularProgress } from '@mui/material'
import { Mic as MicIcon, CloudUpload as UploadIcon, PlayArrow as PlayIcon, Pause as PauseIcon, MoreVert as MoreVertIcon, FilterList as FilterIcon, Person as PersonIcon } from '@mui/icons-material'
import { AudioSample, VoiceCloneStatus, DocumentArtifact } from '@/types'
import { useState } from 'react'
import { EmptyState, LoadingState } from './UIStates'
import { VoiceTrainingModal } from './VoiceTrainingModal'
import { useVoiceLabController } from '@/controllers'

interface VoiceLabPageProps {
  // Props will be managed by controller
}

export function VoiceLabPage({}: VoiceLabPageProps) {
  const {
    audioSamples,
    voiceCloneStatus,
    documents,
    voiceModels,
    selectedFilter,
    isPlaying,
    isRecording,
    isUploading,
    isLoading,
    hasError,
    errorMessage,
    showRecordingModal,
    trainingJob,
    isTraining,
    trainingSamples,
    preprocessingStatus,
    asrStatus,
    queuePosition,
    estimatedStartTime,
    setSelectedFilter,
    togglePlaySample,
    startRecording,
    stopRecording,
    uploadDocument,
    shareDocument,
    refreshData,
    toggleRecordingModal,
    uploadTrainingSample,
    removeTrainingSample,
    startVoiceTraining,
    synthesizeSpeech,
    loadVoiceModels,
    preprocessSamples,
    runASR,
    checkQueueStatus,
    cancelTrainingJob,
    blendVoiceProfile,
  } = useVoiceLabController()

  const filteredDocuments = documents.filter(doc => 
    selectedFilter === 'All' || doc.type === selectedFilter
  )

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4', px: { xs: 3, md: 8 }, py: 6 }}>
      <Grid container spacing={4}>
        {/* Left Column - Voice Cloning */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Box sx={{ backgroundColor: '#ffffff', borderRadius: 4, p: 4, height: '100%' }}>
            {/* Status Row */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
              <Box>
                <Typography variant="h4" className="serif-font" sx={{ color: '#16334a', mb: 1 }}>
                  Voice Cloning
                </Typography>
                <Typography variant="body2" sx={{ color: '#546669' }}>
                  Status: Calibration in progress
                </Typography>
              </Box>
              <Chip 
                label="Active" 
                sx={{ 
                  backgroundColor: '#d0e3e6', 
                  color: '#16334a',
                  fontWeight: 600
                }} 
              />
            </Box>

            {/* Progress Ring */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
              <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                <CircularProgress
                  variant="determinate"
                  value={voiceCloneStatus.percentComplete}
                  size={160}
                  thickness={4}
                  sx={{
                    color: '#16334a',
                    '& .MuiCircularProgress-circle': {
                      strokeLinecap: 'round',
                    },
                  }}
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="h2" className="serif-font" sx={{ color: '#16334a', fontWeight: 600 }}>
                    {voiceCloneStatus.percentComplete}%
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Stats */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="body1" sx={{ color: '#546669', mb: 2, textAlign: 'center' }}>
                {voiceCloneStatus.uploadedCount} recordings uploaded
              </Typography>
              <Typography variant="body1" sx={{ color: '#546669', textAlign: 'center' }}>
                {voiceCloneStatus.remainingCount} more needed
              </Typography>
            </Box>

            {/* Waveform Card */}
            <Card sx={{ backgroundColor: '#f6f3ee', mb: 4, border: 'none', boxShadow: 'none' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ 
                  height: 80, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: 0.5
                }}>
                  {[...Array(12)].map((_, i) => (
                    <Box
                      key={i}
                      sx={{
                        height: [20, 35, 50, 30, 65, 45, 55, 40, 60, 35, 50, 25][i],
                        width: 3,
                        backgroundColor: '#adcae6',
                        borderRadius: 1,
                      }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>

            {/* Record Sample Button */}
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<MicIcon />}
              onClick={toggleRecordingModal}
              sx={{
                background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
                py: 2,
                fontSize: '1.1rem',
                fontWeight: 600,
                mb: 4,
                '&:active': {
                  transform: 'scale(0.98)',
                }
              }}
            >
              Train Voice Clone
            </Button>

            {/* Recent Samples */}
            <Box>
              <Typography variant="h6" sx={{ color: '#16334a', mb: 2, fontWeight: 600 }}>
                Recent Samples
              </Typography>
              {audioSamples.length === 0 ? (
                <Box sx={{ minHeight: 200 }}>
                  <EmptyState type="samples" onAction={() => {}} />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {audioSamples.slice(0, 3).map((sample) => (
                  <Card 
                    key={sample.id}
                    sx={{ 
                      backgroundColor: '#f6f3ee', 
                      border: 'none', 
                      boxShadow: 'none',
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: '#ebe8e3' }
                    }}
                  >
                    <CardContent sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <IconButton
                        size="small"
                        onClick={() => togglePlaySample(sample.id)}
                        sx={{ 
                          backgroundColor: '#ffffff',
                          '&:hover': { backgroundColor: '#d0e3e6' }
                        }}
                      >
                        {isPlaying === sample.id ? <PauseIcon /> : <PlayIcon />}
                      </IconButton>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#16334a' }}>
                          {sample.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#546669' }}>
                          {new Date(sample.recordedAt).toLocaleDateString()} • {Math.floor(sample.durationSeconds / 60)}:{(sample.durationSeconds % 60).toString().padStart(2, '0')}
                        </Typography>
                      </Box>
                      <IconButton size="small" sx={{ color: '#546669' }}>
                        <MoreVertIcon />
                      </IconButton>
                    </CardContent>
                  </Card>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </Grid>

        {/* Right Column - Document Archive */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Box sx={{ backgroundColor: '#ffffff', borderRadius: 4, p: 4, height: '100%' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
              <Typography variant="h4" className="serif-font" sx={{ color: '#16334a' }}>
                Document Archive
              </Typography>
              <IconButton sx={{ color: '#546669' }}>
                <FilterIcon />
              </IconButton>
            </Box>

            {/* Filter Chips */}
            <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
              {['All', 'PDFs', 'Handwritten'].map((filter) => (
                <Chip
                  key={filter}
                  label={filter}
                  onClick={() => setSelectedFilter(filter)}
                  sx={{
                    backgroundColor: selectedFilter === filter ? '#16334a' : '#f6f3ee',
                    color: selectedFilter === filter ? 'white' : '#546669',
                    fontWeight: 600,
                    '&:hover': {
                      backgroundColor: selectedFilter === filter ? '#2e4a62' : '#ebe8e3',
                    }
                  }}
                />
              ))}
            </Box>

            {/* Document Grid */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
              {filteredDocuments.length === 0 ? (
                <Grid size={12}>
                  <EmptyState type="documents" onAction={() => {}} />
                </Grid>
              ) : (
                <>
                  {filteredDocuments.map((doc) => (
                <Grid key={doc.id} size={{ xs: 6, sm: 4 }}>
                  <Card
                    sx={{
                      backgroundColor: '#f6f3ee',
                      border: 'none',
                      boxShadow: 'none',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 2,
                      }
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      {/* Thumbnail */}
                      <Box
                        sx={{
                          aspectRatio: '3/4',
                          backgroundColor: '#ebe8e3',
                          borderRadius: 2,
                          mb: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundImage: doc.thumbnailUrl ? `url(${doc.thumbnailUrl})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      >
                        {!doc.thumbnailUrl && (
                          <Typography variant="h6" sx={{ color: '#adcae6', fontWeight: 'bold' }}>
                            {doc.type.toUpperCase()}
                          </Typography>
                        )}
                      </Box>
                      
                      {/* Type Pill */}
                      <Chip
                        label={doc.type}
                        size="small"
                        sx={{
                          backgroundColor: '#ffffff',
                          color: '#546669',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          mb: 1,
                        }}
                      />
                      
                      {/* Title */}
                      <Typography
                        variant="body2"
                        sx={{
                          color: '#16334a',
                          fontWeight: 600,
                          mb: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {doc.title}
                      </Typography>
                      
                      {/* Date */}
                      <Typography variant="caption" sx={{ color: '#546669' }}>
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </Typography>
                      
                      {/* Share Action */}
                      <Button
                        size="small"
                        sx={{
                          color: '#16334a',
                          textTransform: 'none',
                          p: 0,
                          mt: 1,
                          '&:hover': { backgroundColor: 'transparent' }
                        }}
                      >
                        {doc.shareAction}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
                  ))}
                  
                  {/* Upload Artifact Card */}
                  <Grid size={{ xs: 6, sm: 4 }}>
                <Card
                  sx={{
                    backgroundColor: '#f6f3ee',
                    border: '2px dashed #d0e3e6',
                    boxShadow: 'none',
                    cursor: 'pointer',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    '&:hover': {
                      backgroundColor: '#ebe8e3',
                      borderColor: '#16334a',
                    }
                  }}
                >
                  <CardContent sx={{ p: 2, textAlign: 'center' }}>
                    <UploadIcon sx={{ fontSize: 32, color: '#adcae6', mb: 1 }} />
                    <Typography variant="body2" sx={{ color: '#546669', fontWeight: 600 }}>
                      Upload Artifact
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </>
          )}
        </Grid>
      </Box>
    </Grid>
  </Grid>
    
    {/* Voice Training Modal */}
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
  </Box>
  )
}
