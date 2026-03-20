import { Box, Typography, Card, CardContent, Button, IconButton, TextField, Avatar, Chip } from '@mui/material'
import { ArrowBack as BackIcon, Mic as MicIcon, MicOff as MuteIcon, Send as SendIcon, AddPhotoAlternate as PhotoIcon, VolumeUp as SpeakerIcon } from '@mui/icons-material'
import { ConversationMessage, LegacySubject } from '@/types'
import { useState, useRef, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'

interface TalkPageProps {
  messages: ConversationMessage[]
  legacySubject: LegacySubject
}

export function TalkPage({ messages, legacySubject }: TalkPageProps) {
  const [inputText, setInputText] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = () => {
    if (inputText.trim()) {
      // In a real implementation, this would send the message
      setInputText('')
      setIsTyping(true)
      // Simulate response
      setTimeout(() => setIsTyping(false), 2000)
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
        <Chip 
          icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4caf50', mr: 1 }} />}
          label="Live" 
          size="small"
          sx={{ 
            backgroundColor: '#e8f5e9', 
            color: '#2e7d32',
            fontWeight: 600
          }} 
        />
        <Avatar 
          src={legacySubject.avatarUrl} 
          sx={{ width: 40, height: 40 }}
        />
        <IconButton 
          sx={{ color: '#546669' }}
          aria-label="Speaker settings"
        >
          <SpeakerIcon />
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
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
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
            disabled={!inputText.trim()}
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
