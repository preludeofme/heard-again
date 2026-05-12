import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import {
  Box,
  Stack,
  Typography,
  Card,
  CardContent,
  Avatar,
  CircularProgress,
  Container,
  Button,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Paper,
} from '@mui/material'
import {
  Forum as ChatIcon,
  ArrowForward as ArrowForwardIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  Add as AddIcon,
} from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'
import { useChatConversation } from '@/controllers/useChatConversation'
import { formatDistanceToNow } from 'date-fns'

export default function ChatListPage() {
  const router = useRouter()
  const [people, setPeople] = useState<any[]>([])
  const [isLoadingPeople, setIsLoadingPeople] = useState(true)
  
  const { 
    sessions, 
    isLoadingSessions, 
    loadSessions, 
    deleteSession 
  } = useChatConversation({
    onError: (msg) => console.error(msg),
  })

  useEffect(() => {
    // Load people and sessions
    setIsLoadingPeople(true)
    
    Promise.all([
      fetch('/api/people', { credentials: 'include' }).then(res => res.json()),
      loadSessions()
    ]).then(([peopleData]) => {
      if (peopleData.success) setPeople(peopleData.data || [])
      setIsLoadingPeople(false)
    })
  }, [loadSessions])

  return (
    <Layout>
      <Head>
        <title>Conversations | Heard Again</title>
      </Head>

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
        <Box sx={{ mb: 6 }}>
          <Typography variant="h3" className="serif-font" sx={{ color: '#16334a', mb: 2 }}>
            Conversations
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600 }}>
            Continue talking with your ancestors to discover their history and record new stories in their own voice.
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' }, gap: 4 }}>
          {/* Active Sessions */}
          <Box>
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#16334a' }}>
                Recent Chats
              </Typography>
            </Box>

            {isLoadingSessions ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : sessions.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, border: '1px dashed #d0e3e6', bgcolor: 'transparent' }} elevation={0}>
                <HistoryIcon sx={{ fontSize: 48, color: '#d0e3e6', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  No active conversations yet. Select a family member to start chatting.
                </Typography>
              </Paper>
            ) : (
              <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <List disablePadding>
                  {sessions.map((session, index) => {
                    const person = people.find(p => p.id === session.personId)
                    return (
                      <Box key={session.id}>
                        <ListItemButton
                          onClick={() => router.push(`/chat/${session.personId}`)}
                          sx={{ py: 2, px: 3 }}
                        >
                          <ListItemAvatar>
                            <Avatar src={person?.avatarUrl} sx={{ bgcolor: '#16334a' }}>
                              {person?.firstName?.[0] || 'A'}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText 
                            primary={session.title || `Chat with ${person?.firstName || 'Ancestor'}`}
                            secondary={`Last active ${formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}`}
                            primaryTypographyProps={{ fontWeight: 600, color: '#16334a' }}
                          />
                          <ListItemSecondaryAction>
                            <IconButton edge="end" size="small" onClick={(e) => {
                              e.stopPropagation()
                              deleteSession(session.id)
                            }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItemButton>
                        {index < sessions.length - 1 && <Divider />}
                      </Box>
                    )
                  })}
                </List>
              </Card>
            )}
          </Box>

          {/* Family Members Selection */}
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#16334a', mb: 3 }}>
              Start a New Chat
            </Typography>

            {isLoadingPeople ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Stack spacing={2}>
                {people.map((person) => (
                  <Card 
                    key={person.id}
                    onClick={() => router.push(`/chat/${person.id}`)}
                    sx={{ 
                      borderRadius: 3, 
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': { 
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.08)' 
                      }
                    }}
                    elevation={0}
                    variant="outlined"
                  >
                    <CardContent sx={{ py: '16px !important', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar src={person.avatarUrl} sx={{ bgcolor: '#f0ede8', color: '#16334a' }}>
                        {person.firstName?.[0]}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {person.firstName} {person.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {person.personType.toLowerCase()}
                        </Typography>
                      </Box>
                      <ArrowForwardIcon fontSize="small" sx={{ color: 'rgba(0,0,0,0.2)' }} />
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </Box>
        </Box>
      </Container>
    </Layout>
  )
}


export async function getServerSideProps() { return { props: {} } }
