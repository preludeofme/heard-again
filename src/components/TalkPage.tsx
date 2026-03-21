import { Box, Typography, Card, CardContent, Button, IconButton, TextField, Avatar, Chip, Select, MenuItem, FormControl, InputLabel, Slider, Dialog,DialogTitle,DialogContent,DialogActions } from '@mui/material'
import { ArrowBack as BackIcon, Mic as MicIcon, MicOff as MuteIcon, Send as SendIcon, AddPhotoAlternate as PhotoIcon, VolumeUp as SpeakerIcon, Settings as SettingsIcon, Compare as CompareIcon, Close as CloseIcon } from '@mui/icons-material'
import { ConversationMessage, LegacySubject, VoiceModel } from '@/types'
import { useState, useRef, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useTalkController } from '@/controllers/useTalkController'

interface TalkPageProps {
  messages: ConversationMessage[]
  legacySubject: LegacySubject
}

export function TalkPage({ messages, legacySubject }: TalkPageProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [showVoiceSettings, setShowVoiceSettings] = useState(false)
  const [showComparisonDialog, setShowComparisonDialog] = useState(false)
  const [comparisonText, setComparisonText] = useState('')
  const [comparisonResults, setComparisonResults] = useState<{ audioA: string | null; audioB: string | null } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const controller = useTalkController()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (controller.inputText.trim()) {
      await controller.sendMessage()
      setIsTyping(true)
      
      // Simulate response and synthesize speech
      setTimeout(async () => {
        setIsTyping(false)
        if (controller.selectedVoiceModel && controller.messages.length > 0) {
          const lastMessage = controller.messages[controller.messages.length - 1]
          if (lastMessage.sender === 'LegacySubject') {
            const audioUrl = await controller.synthesizeSpeech(lastMessage.content)
            if (audioUrl) {
              controller.playAudio(audioUrl)
            }
          }
        }
      }, 2000)
    }
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fcf9f4' }}>
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
        <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600, flexGrow: 1 }}>
          Conversation with {legacySubject.fullName}
        </Typography>
        
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

      {/* Messages List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', px: { xs: 2, md: 4 }, py: 4 }}>
        {messages.map((message) => (
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
        {isTyping && (
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
        {isListening && (
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

      {/* Input Bar */}
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
            {isMuted ? 'Unmuted' : 'Muted'}
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
            onClick={() => setIsListening(!isListening)}
            sx={{ 
              backgroundColor: isListening ? '#16334a' : '#f6f3ee',
              color: isListening ? 'white' : '#546669',
              '&:hover': {
                backgroundColor: isListening ? '#2e4a62' : '#ebe8e3',
              }
            }}
            aria-label={isListening ? 'Stop listening' : 'Start listening'}
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
      </Box>
      
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
                    if (model && controller.comparisonModelB) {
                      controller.setComparisonModels(model, controller.comparisonModelB)
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
                    if (model && controller.comparisonModelA) {
                      controller.setComparisonModels(controller.comparisonModelA, model)
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
                const { audioA, audioB } = await controller.compareVoices(comparisonText)
                setComparisonResults({ audioA, audioB })
              }
            }}
            disabled={!comparisonText || !controller.comparisonModelA || !controller.comparisonModelB}
          >
            Generate Comparison
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
