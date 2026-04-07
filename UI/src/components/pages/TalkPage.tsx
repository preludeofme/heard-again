import { Box, Typography, Card, CardContent, Button, IconButton, TextField, Avatar, Chip, Select, MenuItem, FormControl, InputLabel, Slider, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Alert, List, ListItemButton, ListItemText, Tooltip } from '@mui/material'
import { ArrowBack as BackIcon, Mic as MicIcon, MicOff as MuteIcon, Send as SendIcon, AddPhotoAlternate as PhotoIcon, VolumeUp as SpeakerIcon, Settings as SettingsIcon, Compare as CompareIcon, Close as CloseIcon, Add as AddIcon, Person as PersonIcon, AutoAwesome as AutoAwesomeIcon, Delete as DeleteIcon, Info as InfoIcon } from '@mui/icons-material'
import { ConversationMessage, LegacySubject, VoiceModel } from '@/types'
import { useState, useRef, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useTalkController } from '@/controllers/useTalkController'
import { FamilyMemberSearch, SearchableFamilyMember } from '@/components/search'
import { useRouter } from 'next/router'

interface TalkPageProps {
  legacySubject: LegacySubject
  subjectId?: string
  availablePeople?: SearchableFamilyMember[]
}

export function TalkPage({ legacySubject, subjectId, availablePeople = [] }: TalkPageProps) {
  const router = useRouter()
  const [isMuted, setIsMuted] = useState(false)
  const [showVoiceSettings, setShowVoiceSettings] = useState(false)
  const [showComparisonDialog, setShowComparisonDialog] = useState(false)
  const [showNewConversationDialog, setShowNewConversationDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [comparisonText, setComparisonText] = useState('')
  const [comparisonResults, setComparisonResults] = useState<{ audioA: string | null; audioB: string | null } | null>(null)
  const [isComparing, setIsComparing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const controller = useTalkController(subjectId)

  // Load all sessions on mount
  useEffect(() => {
    controller.loadSessions()
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [controller.messages])

  const handleSendMessage = async () => {
    if (controller.inputText.trim()) {
      await controller.sendMessage()
    }
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', backgroundColor: '#fcf9f4' }}>
      {/* Sidebar */}
      <Box sx={{ 
        width: 280, 
        minWidth: 280,
        backgroundColor: '#ffffff', 
        borderRight: '1px solid #f0ece4',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <Box sx={{ p: 2.5, borderBottom: '1px solid #f0ece4' }}>
          <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600, mb: 1.5 }}>
            Conversations
          </Typography>
          <Button
            fullWidth
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowNewConversationDialog(true)}
            sx={{
              background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
              fontWeight: 600,
              textTransform: 'none',
            }}
          >
            New Conversation
          </Button>
        </Box>

        {/* Session list */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
          {controller.isLoadingSessions ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <CircularProgress size={24} sx={{ color: '#adcae6' }} />
            </Box>
          ) : controller.sessions.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#9aafb3', mt: 3, textAlign: 'center', px: 2 }}>
              Start conversations from the family tree to see them here.
            </Typography>
          ) : (
            <List disablePadding>
              {controller.sessions.map(session => (
                <Box
                  key={session.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    borderBottom: '1px solid #f5f0ea',
                    '&:hover .delete-btn': { opacity: 1 },
                  }}
                >
                  <ListItemButton
                    selected={session.id === (controller as any).sessionId}
                    onClick={() => controller.switchSession(session.id)}
                    sx={{
                      flexGrow: 1,
                      py: 1.5,
                      '&.Mui-selected': { backgroundColor: '#f0f7ff' },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: '#16334a' }}>
                          {session.title}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" sx={{ color: '#9aafb3' }}>
                          {session.updatedAt ? new Date(session.updatedAt).toLocaleDateString() : ''}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                  <Tooltip title="Delete conversation">
                    <IconButton
                      className="delete-btn"
                      size="small"
                      onClick={() => controller.deleteSession(session.id)}
                      sx={{ mr: 0.5, opacity: 0, transition: 'opacity 0.15s', color: '#c62828' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </List>
          )}
        </Box>
      </Box>
      
      {/* Main Content */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ 
          backgroundColor: '#ffffff', 
          px: { xs: 2, md: 4 }, 
          py: 2, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          borderBottom: '1px solid #f0ece4'
        }}>
        <IconButton 
          sx={{ color: '#546669' }}
          aria-label="Go back"
        >
          <BackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600 }}>
            Conversation with {legacySubject.fullName}
          </Typography>
          {controller.personaExists && controller.personaConfidence !== undefined && (
            <Chip
              icon={<InfoIcon sx={{ fontSize: '14px !important' }} />}
              label={`${Math.round(controller.personaConfidence * 100)}% confidence`}
              size="small"
              sx={{
                mt: 0.25,
                backgroundColor: controller.personaConfidence >= 0.7 ? '#e8f5e9'
                  : controller.personaConfidence >= 0.4 ? '#fff3e0' : '#ffebee',
                color: controller.personaConfidence >= 0.7 ? '#2e7d32'
                  : controller.personaConfidence >= 0.4 ? '#ef6c00' : '#c62828',
                fontWeight: 600,
                fontSize: '11px',
                height: 20,
              }}
            />
          )}
        </Box>
        
        {/* Voice Selection Dropdown */}
        {controller.voiceModels.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 150, mr: 2 }}>
            <InputLabel>Voice</InputLabel>
            <Select
              value={controller.selectedVoiceModel?.id || ''}
              label="Voice"
              onChange={(e) => {
                const model = controller.voiceModels.find(m => m.id === e.target.value)
                if (model) controller.selectVoiceModel(model)
              }}
            >
              {controller.voiceModels.map((model) => (
                <MenuItem key={model.id} value={model.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">
                      {model.displayName || model.name}
                    </Typography>
                    {model.similarityScore && (
                      <Typography variant="caption" sx={{ color: '#666' }}>
                        {Math.round(model.similarityScore * 100)}%
                      </Typography>
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        
        <Chip 
          icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4caf50', mr: 1 }} />}
          label="Live" 
          size="small"
          sx={{ 
            backgroundColor: '#e8f5e9', 
            color: '#2e7d32',
            fontWeight: 600,
            mr: 1
          }} 
        />
        <Chip
          size="small"
          label={`Voice: ${controller.synthesisStatus}`}
          sx={{
            textTransform: 'capitalize',
            backgroundColor:
              controller.synthesisStatus === 'processing' ? '#fff3e0'
              : controller.synthesisStatus === 'completed' ? '#e8f5e9'
              : controller.synthesisStatus === 'failed' ? '#ffebee'
              : '#eceff1',
            color:
              controller.synthesisStatus === 'processing' ? '#ef6c00'
              : controller.synthesisStatus === 'completed' ? '#2e7d32'
              : controller.synthesisStatus === 'failed' ? '#c62828'
              : '#546669',
            fontWeight: 600,
            mr: 1,
          }}
        />
        <Avatar 
          src={legacySubject.avatarUrl} 
          sx={{ width: 40, height: 40, mr: 1 }}
        />
        <IconButton 
          sx={{ color: '#546669', mr: 1 }}
          aria-label="Voice comparison"
          onClick={() => setShowComparisonDialog(true)}
        >
          <CompareIcon />
        </IconButton>
        <IconButton 
          sx={{ color: '#546669' }}
          aria-label="Speaker settings"
          onClick={() => setShowVoiceSettings(true)}
        >
          <SettingsIcon />
        </IconButton>
      </Box>

      {/* Persona Generation Required Section */}
      {controller.needsPersonaGeneration && (
        <Box sx={{ 
          flexGrow: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          px: { xs: 2, md: 4 },
          py: 4
        }}>
          <Card sx={{ maxWidth: 520, textAlign: 'center', p: 4 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                <Avatar sx={{ 
                  width: 80, 
                  height: 80, 
                  bgcolor: '#f6f3ee',
                  color: '#16334a'
                }}>
                  <PersonIcon sx={{ fontSize: 40 }} />
                </Avatar>
              </Box>
              
              <Typography variant="h5" sx={{ color: '#16334a', fontWeight: 600, mb: 2 }}>
                {legacySubject.fullName}'s Persona Not Ready
              </Typography>
              
              <Typography variant="body1" sx={{ color: '#546669', mb: 3, lineHeight: 1.6 }}>
                To have authentic conversations with {legacySubject.fullName}, follow these two steps:
              </Typography>

              <Box sx={{ textAlign: 'left', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
                  <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#16334a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700 }}>1</Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#16334a' }}>Upload documents</Typography>
                    <Typography variant="body2" sx={{ color: '#546669' }}>
                      Go to the Documents page and upload letters, writings, or transcripts for {legacySubject.fullName}. Make sure the person is selected before uploading.
                    </Typography>
                    {subjectId && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => router.push(`/documents?personId=${subjectId}`)}
                        sx={{ mt: 1, textTransform: 'none', borderColor: '#16334a', color: '#16334a' }}
                      >
                        Go to Documents →
                      </Button>
                    )}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#adcae6', color: '#16334a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700 }}>2</Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#16334a' }}>Generate the AI persona</Typography>
                    <Typography variant="body2" sx={{ color: '#546669' }}>
                      Once documents are uploaded and processed, return here and click the button below to build the persona.
                    </Typography>
                  </Box>
                </Box>
              </Box>
              
              <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
                <Typography variant="body2">
                  At least one document (PDF, Word, or plain text) must be uploaded and indexed before persona generation. Processing takes a few seconds after upload.
                </Typography>
              </Alert>
              
              <Button
                variant="contained"
                size="large"
                startIcon={controller.isLoading ? <CircularProgress size={20} color="inherit" /> : <AutoAwesomeIcon />}
                onClick={controller.generatePersona}
                disabled={controller.isLoading}
                fullWidth
                sx={{
                  background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
                  fontWeight: 600,
                  py: 1.5,
                }}
              >
                {controller.isLoading ? 'Generating Persona...' : `Build ${legacySubject.fullName}'s Persona`}
              </Button>
              
              <Typography variant="caption" sx={{ color: '#546669', mt: 2, display: 'block' }}>
                This may take a minute depending on the amount of data available
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Low Confidence Warning */}
      {controller.personaConfidence !== undefined && controller.personaConfidence < 0.3 && !controller.needsPersonaGeneration && (
        <Box sx={{ px: { xs: 2, md: 4 }, py: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Limited data available — responses may be less accurate. Consider adding more documents or memories for {legacySubject.fullName}.
            </Typography>
          </Alert>
        </Box>
      )}

      {/* Messages List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', px: { xs: 2, md: 4 }, py: 4 }}>
        {controller.messages.map((message) => (
          <Box
            key={message.id}
            sx={{
              display: 'flex',
              justifyContent: message.sender === 'User' ? 'flex-end' : 'flex-start',
              mb: 3,
            }}
          >
            <Box sx={{ maxWidth: '70%' }}>
              {message.sender === 'LegacySubject' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Avatar 
                    src={legacySubject.avatarUrl} 
                    sx={{ width: 24, height: 24 }}
                  />
                  <Typography variant="caption" sx={{ color: '#546669', fontWeight: 600 }}>
                    {legacySubject.fullName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#546669' }}>
                    {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                  </Typography>
                </Box>
              )}
              
              <Card
                sx={{
                  backgroundColor: message.sender === 'User' ? '#16334a' : '#ffffff',
                  color: message.sender === 'User' ? 'white' : 'inherit',
                  borderRadius: 4,
                  boxShadow: 1,
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
                    {message.content}
                  </Typography>
                </CardContent>
              </Card>
              
              {message.sender === 'User' && (
                <Typography variant="caption" sx={{ color: '#546669', mt: 1, display: 'block', textAlign: 'right' }}>
                  {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                </Typography>
              )}
            </Box>
          </Box>
        ))}
        
        {/* Typing Indicator */}
        {controller.talkState === 'typing' && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 3 }}>
            <Card sx={{ backgroundColor: '#ffffff', borderRadius: 4, boxShadow: 1 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  <Box sx={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    backgroundColor: '#adcae6',
                    animation: 'pulse 1.4s infinite ease-in-out'
                  }} />
                  <Box sx={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    backgroundColor: '#adcae6',
                    animation: 'pulse 1.4s infinite ease-in-out 0.2s'
                  }} />
                  <Box sx={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    backgroundColor: '#adcae6',
                    animation: 'pulse 1.4s infinite ease-in-out 0.4s'
                  }} />
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}
        
        <div ref={messagesEndRef} />
      </Box>

      {/* Listening Centerpiece */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        py: 4,
        px: { xs: 2, md: 4 }
      }}>
        {controller.isListening && (
          <>
            {/* Animated Rings */}
            <Box sx={{ position: 'relative', mb: 2 }}>
              <Box sx={{
                position: 'absolute',
                width: 80,
                height: 80,
                borderRadius: '50%',
                border: '2px solid #adcae6',
                animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
              }} />
              <Box sx={{
                position: 'absolute',
                width: 80,
                height: 80,
                borderRadius: '50%',
                border: '2px solid #adcae6',
                animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite 0.5s',
              }} />
              <Box sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: '#16334a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <MicIcon sx={{ color: 'white', fontSize: 32 }} />
              </Box>
            </Box>
            <Typography variant="body2" sx={{ color: '#546669', fontStyle: 'italic' }}>
              {legacySubject.fullName} is listening...
            </Typography>
          </>
        )}
      </Box>

      {/* Input Bar - Only show when persona is ready */}
      {!controller.needsPersonaGeneration && (
      <Box sx={{ 
        backgroundColor: '#ffffff', 
        px: { xs: 2, md: 4 }, 
        py: 3,
        borderTop: '1px solid #f0ece4'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="text"
            startIcon={isMuted ? <MuteIcon /> : <MicIcon />}
            onClick={() => setIsMuted(!isMuted)}
            sx={{ 
              color: isMuted ? '#d32f2f' : '#546669',
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            {isMuted ? 'Unmute' : 'Mute'}
          </Button>
          
          <Button
            variant="text"
            startIcon={<DeleteIcon />}
            onClick={() => setShowResetDialog(true)}
            sx={{ 
              color: '#546669',
              textTransform: 'none',
              fontWeight: 600
            }}
            disabled={!controller.sessionId}
          >
            Reset
          </Button>
          
          <TextField
            fullWidth
            placeholder="Type a memory or just say hello..."
            value={controller.inputText}
            onChange={(e) => controller.setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#f6f3ee',
                borderRadius: 3,
                '& fieldset': { border: 'none' },
                '&:hover fieldset': { border: 'none' },
                '&.Mui-focused fieldset': { border: 'none' },
                '&.Mui-focused': { backgroundColor: '#ffffff' }
              }
            }}
          />
          
          <IconButton 
            sx={{ color: '#546669' }}
            aria-label="Attach photo"
          >
            <PhotoIcon />
          </IconButton>
          
          <IconButton
            onClick={() => {
              if (controller.isListening) {
                controller.stopListening()
              } else {
                controller.startListening()
              }
            }}
            sx={{ 
              backgroundColor: controller.isListening ? '#16334a' : '#f6f3ee',
              color: controller.isListening ? 'white' : '#546669',
              '&:hover': {
                backgroundColor: controller.isListening ? '#2e4a62' : '#ebe8e3',
              }
            }}
            aria-label={controller.isListening ? 'Stop listening' : 'Start listening'}
          >
            <MicIcon />
          </IconButton>
          
          <Button
            variant="contained"
            onClick={handleSendMessage}
            disabled={!controller.inputText.trim()}
            aria-label="Send message"
            sx={{
              backgroundColor: '#16334a',
              '&:hover': { backgroundColor: '#2e4a62' },
              '&:disabled': { backgroundColor: '#e0e0e0' }
            }}
          >
            <SendIcon />
          </Button>
        </Box>
        
        <Typography variant="caption" sx={{ color: '#546669', mt: 2, display: 'block', textAlign: 'center' }}>
          Encrypted Connection • Archive Active
        </Typography>

        {controller.lastSynthesisOutputAssetDownloadUrl && (
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
            <Button
              size="small"
              variant="text"
              component="a"
              href={controller.lastSynthesisOutputAssetDownloadUrl}
              sx={{ textTransform: 'none' }}
            >
              Download latest generated audio
            </Button>
          </Box>
        )}
      </Box>
      )}
      
      {/* Voice Settings Dialog */}
      <Dialog open={showVoiceSettings} onClose={() => setShowVoiceSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Voice Settings</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 3 }}>
            Adjust the voice synthesis settings for {legacySubject.fullName}
          </Typography>
          
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Voice Model</InputLabel>
            <Select
              value={controller.selectedVoiceModel?.id || ''}
              label="Voice Model"
              onChange={(e) => {
                const model = controller.voiceModels.find(m => m.id === e.target.value)
                if (model) controller.selectVoiceModel(model)
              }}
            >
              {controller.voiceModels.map((model) => (
                <MenuItem key={model.id} value={model.id}>
                  <Box>
                    <Typography variant="body1">{model.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {model.sampleCount} samples • Similarity: {model.similarityScore ? `${Math.round(model.similarityScore * 100)}%` : 'N/A'}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Box sx={{ mb: 3 }}>
            <Typography gutterBottom>Speech Speed</Typography>
            <Slider
              defaultValue={1.0}
              min={0.5}
              max={2.0}
              step={0.1}
              marks={[
                { value: 0.5, label: '0.5x' },
                { value: 1.0, label: '1.0x' },
                { value: 1.5, label: '1.5x' },
                { value: 2.0, label: '2.0x' },
              ]}
              valueLabelDisplay="auto"
            />
          </Box>
          
          <Box sx={{ mb: 3 }}>
            <Typography gutterBottom>Pitch</Typography>
            <Slider
              defaultValue={1.0}
              min={0.5}
              max={1.5}
              step={0.1}
              marks={[
                { value: 0.5, label: 'Low' },
                { value: 1.0, label: 'Normal' },
                { value: 1.5, label: 'High' },
              ]}
              valueLabelDisplay="auto"
            />
          </Box>
          
          {controller.currentAudioUrl && (
            <Box sx={{ mt: 2, p: 2, backgroundColor: '#f6f3ee', borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Currently Playing:
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton 
                  onClick={controller.stopAudio}
                  sx={{ color: '#16334a' }}
                >
                  <SpeakerIcon />
                </IconButton>
                <Typography variant="body2">Voice Sample</Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVoiceSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Voice Comparison Dialog */}
      <Dialog 
        open={showComparisonDialog} 
        onClose={() => {
          setShowComparisonDialog(false)
          setComparisonResults(null)
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Voice Comparison
            <IconButton onClick={() => setShowComparisonDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 3 }}>
            Compare two different voice models with the same text
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Text to synthesize"
            value={comparisonText}
            onChange={(e) => setComparisonText(e.target.value)}
            placeholder="Enter text to compare voices..."
            sx={{ mb: 3 }}
          />
          
          {controller.voiceModels.length >= 2 && (
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Voice A</InputLabel>
                <Select
                  value={controller.comparisonModelA?.id || ''}
                  label="Voice A"
                  onChange={(e) => {
                    const model = controller.voiceModels.find(m => m.id === e.target.value)
                    if (model) {
                      controller.setComparisonModelA(model)
                    }
                  }}
                >
                  {controller.voiceModels.map((model) => (
                    <MenuItem key={model.id} value={model.id}>
                      {model.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl fullWidth>
                <InputLabel>Voice B</InputLabel>
                <Select
                  value={controller.comparisonModelB?.id || ''}
                  label="Voice B"
                  onChange={(e) => {
                    const model = controller.voiceModels.find(m => m.id === e.target.value)
                    if (model) {
                      controller.setComparisonModelB(model)
                    }
                  }}
                >
                  {controller.voiceModels.map((model) => (
                    <MenuItem key={model.id} value={model.id}>
                      {model.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}
          
          <Button
            variant="contained"
            fullWidth
            onClick={async () => {
              if (comparisonText && controller.comparisonModelA && controller.comparisonModelB) {
                setComparisonResults(null)
                setIsComparing(true)
                try {
                  const { audioA, audioB } = await controller.compareVoices(comparisonText)
                  setComparisonResults({ audioA, audioB })
                } finally {
                  setIsComparing(false)
                }
              }
            }}
            disabled={!comparisonText || !controller.comparisonModelA || !controller.comparisonModelB || isComparing}
            startIcon={isComparing ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {isComparing ? 'Generating...' : 'Generate Comparison'}
          </Button>
          
          {/* Display Comparison Results */}
          {comparisonResults && (
            <Box sx={{ mt: 3, p: 2, backgroundColor: '#f6f3ee', borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>
                Comparison Results
              </Typography>
              
              {/* Voice A */}
              {comparisonResults.audioA && controller.comparisonModelA && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Voice A: {controller.comparisonModelA.displayName}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <audio controls src={comparisonResults.audioA} style={{ width: '100%' }} />
                  </Box>
                </Box>
              )}
              
              {/* Voice B */}
              {comparisonResults.audioB && controller.comparisonModelB && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Voice B: {controller.comparisonModelB.displayName}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <audio controls src={comparisonResults.audioB} style={{ width: '100%' }} />
                  </Box>
                </Box>
              )}
              
              {/* Error messages */}
              {!comparisonResults.audioA && !comparisonResults.audioB && (
                <Typography variant="body2" color="error">
                  Failed to generate comparison audio
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* New Conversation Dialog */}
      <Dialog
        open={showNewConversationDialog}
        onClose={() => setShowNewConversationDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Start New Conversation
            <IconButton onClick={() => setShowNewConversationDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: '#546669' }}>
            Search for and select a family member to start a conversation with.
          </Typography>
          <FamilyMemberSearch
            members={availablePeople}
            onSelect={(member) => {
              if (member) {
                router.push(`/talk?subjectId=${encodeURIComponent(member.id)}`)
                setShowNewConversationDialog(false)
              }
            }}
            placeholder="Search by name..."
            title="Select Family Member"
            defaultExpanded={true}
            showExpandButton={false}
            showSelectedChip={false}
            allowClear={false}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewConversationDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
      
      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onClose={() => setShowResetDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Reset Conversation?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This will clear the entire conversation history and start a new conversation with {legacySubject.fullName}. 
            This action cannot be undone.
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            All messages in this conversation will be permanently deleted.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResetDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={async () => {
              if (controller.sessionId) {
                await controller.deleteSession(controller.sessionId)
                setShowResetDialog(false)
              }
            }}
            color="error"
            variant="contained"
          >
            Reset Conversation
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
      
      <style jsx>{`
        @keyframes pulse {
          0%, 80%, 100% {
            opacity: 0.3;
          }
          40% {
            opacity: 1;
          }
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
          0% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </Box>
  )
}
