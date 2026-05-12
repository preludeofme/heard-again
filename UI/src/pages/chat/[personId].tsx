import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Typography,
  Avatar,
  TextField,
  IconButton,
  Paper,
  Stack,
  CircularProgress,
  Container,
  Divider,
  Button,
  Chip,
  Alert,
  Fade,
  Tooltip,
} from '@mui/material'
import {
  Send as SendIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  ArrowBack as BackIcon,
  MoreVert as MoreIcon,
  AutoStories as StoriesIcon,
  Psychology as AIIcon,
  RecordVoiceOver as VoiceIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'
import { useChatConversation } from '@/controllers/useChatConversation'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'
import { format } from 'date-fns'

export default function ChatPage() {
  const router = useRouter()
  const { personId } = router.query
  const subjectId = typeof personId === 'string' ? personId : undefined
  
  const [person, setPerson] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const {
    messages,
    inputText,
    setInputText,
    sendMessage,
    talkState,
    isLoading,
    isListening,
    startListening,
    stopListening,
    needsPersonaGeneration,
    generatePersona,
    personaConfidence,
  } = useChatConversation({
    subjectId,
    onError: (msg) => console.error(msg),
  })

  // Load person details
  useEffect(() => {
    if (subjectId) {
      fetch(`/api/people/${subjectId}`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.success) setPerson(data.data)
        })
    }
  }, [subjectId])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const personName = person?.displayName || `${person?.firstName || ''} ${person?.lastName || ''}`.trim() || 'Ancestor'

  return (
    <Layout>
      <Head>
        <title>Chat with {personName} | Heard Again</title>
      </Head>

      <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', bgcolor: '#fcf9f4' }}>
        {/* Header */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: 2, 
            borderBottom: '1px solid rgba(22,51,74,0.08)', 
            bgcolor: '#ffffff',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => router.back()} size="small">
              <BackIcon />
            </IconButton>
            <Avatar 
              src={person?.avatarUrl} 
              sx={{ width: 40, height: 40, bgcolor: '#16334a' }}
            >
              {person?.firstName?.[0]}
            </Avatar>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#16334a', lineHeight: 1.2 }}>
                {personName}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box 
                  sx={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    bgcolor: talkState === 'idle' ? '#4caf50' : '#ff9800',
                    animation: talkState !== 'idle' ? 'pulse 1.5s infinite' : 'none'
                  }} 
                />
                <Typography variant="caption" color="text.secondary">
                  {talkState === 'typing' ? 'Thinking...' : talkState === 'listening' ? 'Listening...' : 'Online'}
                </Typography>
                {personaConfidence !== undefined && (
                  <Tooltip title={`Confidence: ${Math.round(personaConfidence * 100)}% based on available documents`}>
                    <Chip 
                      label={`${Math.round(personaConfidence * 100)}% match`}
                      size="small"
                      sx={{ height: 16, fontSize: '0.65rem', ml: 1, bgcolor: '#f0ede8' }}
                    />
                  </Tooltip>
                )}
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton size="small" onClick={() => router.push(`/profile/${subjectId}`)}>
              <StoriesIcon fontSize="small" />
            </IconButton>
            <IconButton size="small">
              <MoreIcon fontSize="small" />
            </IconButton>
          </Box>
        </Paper>

        {/* Chat Area */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, md: 4 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {needsPersonaGeneration ? (
            <Box sx={{ m: 'auto', maxWidth: 400, textAlign: 'center', p: 4, bgcolor: '#fff', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <AIIcon sx={{ fontSize: 48, color: '#16334a', mb: 2, opacity: 0.5 }} />
              <Typography variant="h6" sx={{ color: '#16334a', mb: 1 }}>
                Persona Not Ready
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                We need to analyze {person?.firstName}'s stories and documents to build their AI persona before you can chat.
              </Typography>
              <Button 
                variant="contained" 
                onClick={generatePersona}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
                sx={{ bgcolor: '#16334a', borderRadius: 2 }}
              >
                Generate Persona
              </Button>
            </Box>
          ) : messages.length === 0 && !isLoading ? (
            <Box sx={{ m: 'auto', textAlign: 'center', opacity: 0.6 }}>
              <Typography variant="body1" sx={{ fontStyle: 'italic', mb: 1 }}>
                Start a conversation with {person?.firstName}
              </Typography>
              <Typography variant="caption">
                Ask about childhood memories, family traditions, or life advice.
              </Typography>
            </Box>
          ) : (
            <>
              {messages.map((msg) => (
                <Box 
                  key={msg.id} 
                  sx={{ 
                    alignSelf: msg.sender === 'User' ? 'flex-end' : 'flex-start',
                    maxWidth: { xs: '85%', md: '70%' },
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5
                  }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: msg.sender === 'User' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                      bgcolor: msg.sender === 'User' ? '#16334a' : '#ffffff',
                      color: msg.sender === 'User' ? '#ffffff' : '#16334a',
                      boxShadow: msg.sender === 'User' ? '0 4px 12px rgba(22,51,74,0.15)' : '0 2px 8px rgba(0,0,0,0.05)',
                      border: msg.sender === 'User' ? 'none' : '1px solid rgba(22,51,74,0.05)'
                    }}
                  >
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {msg.content}
                    </Typography>
                    {msg.state === 'typing' && (
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                        <Box className="dot" sx={{ width: 4, height: 4, bgcolor: 'currentColor', borderRadius: '50%', animation: 'bounce 1s infinite 0.1s' }} />
                        <Box className="dot" sx={{ width: 4, height: 4, bgcolor: 'currentColor', borderRadius: '50%', animation: 'bounce 1s infinite 0.2s' }} />
                        <Box className="dot" sx={{ width: 4, height: 4, bgcolor: 'currentColor', borderRadius: '50%', animation: 'bounce 1s infinite 0.3s' }} />
                      </Box>
                    )}
                  </Paper>
                  <Typography variant="caption" sx={{ px: 1, opacity: 0.5, alignSelf: msg.sender === 'User' ? 'flex-end' : 'flex-start' }}>
                    {format(msg.timestamp, 'h:mm a')}
                  </Typography>
                </Box>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </Box>

        {/* Input Area */}
        <Box 
          sx={{ 
            p: 2, 
            bgcolor: '#ffffff', 
            borderTop: '1px solid rgba(22,51,74,0.08)',
            pb: { xs: 4, md: 2 } 
          }}
        >
          <Container maxWidth="md" sx={{ px: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
              <IconButton 
                onClick={isListening ? stopListening : startListening}
                color={isListening ? 'error' : 'default'}
                sx={{ 
                  mb: 0.5,
                  bgcolor: isListening ? 'rgba(211, 47, 47, 0.1)' : 'transparent',
                  animation: isListening ? 'pulse-red 1.5s infinite' : 'none'
                }}
              >
                {isListening ? <MicOffIcon /> : <MicIcon />}
              </IconButton>
              
              <TextField
                fullWidth
                multiline
                maxRows={4}
                placeholder={isListening ? "Listening..." : "Message " + person?.firstName + "..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={needsPersonaGeneration || isLoading}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                    bgcolor: '#f6f3ee',
                    '& fieldset': { borderColor: 'transparent' },
                    '&:hover fieldset': { borderColor: 'rgba(22,51,74,0.1)' },
                    '&.Mui-focused fieldset': { borderColor: 'rgba(22,51,74,0.2)' },
                  }
                }}
              />
              
              <IconButton 
                onClick={sendMessage}
                disabled={!inputText.trim() || needsPersonaGeneration || isLoading}
                sx={{ 
                  mb: 0.5,
                  bgcolor: inputText.trim() ? '#16334a' : 'transparent',
                  color: inputText.trim() ? '#fff' : 'rgba(0,0,0,0.26)',
                  '&:hover': { bgcolor: '#2e4a62' }
                }}
              >
                {isLoading && talkState === 'processing' ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
              </IconButton>
            </Box>
          </Container>
        </Box>
      </Box>

      <style jsx global>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(211, 47, 47, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(211, 47, 47, 0); }
          100% { box-shadow: 0 0 0 0 rgba(211, 47, 47, 0); }
        }
      `}</style>
    </Layout>
  )
}

export async function getServerSideProps() { return { props: {} } }
