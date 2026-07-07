import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  Box,
  Container,
  Typography,
  Card,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Grid,
} from '@mui/material'
import {
  CheckCircleOutline as CheckCircleIcon,
  SupportAgent as SupportAgentIcon,
} from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { ProfileColors } from '@/components/profile/ProfileConstants'

function SupportContent() {
  const { data: session } = useSession()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || session.user.displayName || '')
      setEmail(session.user.email || '')
    }
  }, [session])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, subject, message }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      setIsSuccess(true)
      setSubject('')
      setMessage('')
    } catch (err: any) {
      setError(err.message || 'An error occurred while sending your message. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <Card
        sx={{
          bgcolor: ProfileColors.surfaceContainerLowest,
          p: { xs: 4, md: 6 },
          borderRadius: 6,
          boxShadow: '0 10px 40px rgba(28, 28, 25, 0.04)',
          textAlign: 'center',
          maxWidth: 600,
          mx: 'auto',
          transition: 'all 0.3s ease',
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            bgcolor: 'rgba(208, 227, 230, 0.4)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 3,
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 48, color: '#16334a' }} />
        </Box>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            color: ProfileColors.primary,
            mb: 2,
            fontFamily: 'var(--font-newsreader), serif',
            fontWeight: 700,
          }}
        >
          Message Sent!
        </Typography>
        <Typography variant="body1" sx={{ color: ProfileColors.onSurfaceVariant, mb: 4, lineHeight: 1.6 }}>
          Thank you for reaching out. Your support request has been received and will be reviewed shortly. We will get back to you at the email address provided.
        </Typography>
        <Button
          component={Link}
          href="/legacy"
          variant="contained"
          id="contact-success-home"
          sx={{
            py: 1.5,
            px: 4,
            fontSize: '1rem',
            fontWeight: 600,
            borderRadius: 3,
            textTransform: 'none',
            background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
            boxShadow: '0 4px 14px rgba(22, 51, 74, 0.2)',
          }}
        >
          Return to Dashboard
        </Button>
      </Card>
    )
  }

  return (
    <Card
      sx={{
        bgcolor: ProfileColors.surfaceContainerLowest,
        p: { xs: 4, md: 6 },
        borderRadius: 6,
        boxShadow: '0 10px 40px rgba(28, 28, 25, 0.04)',
        maxWidth: 700,
        mx: 'auto',
      }}
    >
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            bgcolor: 'rgba(208, 227, 230, 0.3)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
          }}
        >
          <SupportAgentIcon sx={{ fontSize: 32, color: ProfileColors.primary }} />
        </Box>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            color: ProfileColors.primary,
            mb: 1,
            fontFamily: 'var(--font-newsreader), serif',
            fontWeight: 700,
          }}
        >
          How can we help?
        </Typography>
        <Typography variant="body2" sx={{ color: ProfileColors.onSurfaceVariant, maxWidth: 500, mx: 'auto' }}>
          Have a question about Heard Again or need assistance? Fill out the contact form below and our team will get back to you shortly.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} id="contact-error-alert">
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} id="contact-form">
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Your Name (Optional)"
              id="contact-name"
              placeholder="Alex Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              variant="outlined"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              required
              label="Email Address"
              type="email"
              id="contact-email"
              placeholder="alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              variant="outlined"
              helperText="This email is only used so we can reply to your inquiry."
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              required
              label="Subject"
              id="contact-subject"
              placeholder="How can we help you today?"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              variant="outlined"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              required
              multiline
              rows={5}
              label="How can we help?"
              id="contact-message"
              placeholder="Please describe what you need or ask your question here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              variant="outlined"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              id="contact-submit"
              disabled={isLoading}
              sx={{
                py: 2,
                fontSize: '1.05rem',
                fontWeight: 600,
                borderRadius: 3,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
                boxShadow: '0 4px 14px rgba(22, 51, 74, 0.2)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #2e4a62 0%, #16334a 100%)',
                },
              }}
            >
              {isLoading ? (
                <CircularProgress size={24} sx={{ color: 'white' }} />
              ) : (
                'Send Message'
              )}
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Card>
  )
}

export default function SupportPage() {
  const { data: session, status } = useSession()

  // During loading, show a centered spinner
  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: ProfileColors.surface }}>
        <CircularProgress />
      </Box>
    )
  }

  // If the user is logged in, show the support form inside the standard app layout
  if (session?.user) {
    return (
      <>
        <Head>
          <title>Support & Contact - Heard Again</title>
          <meta name="description" content="Contact the Heard Again support team for help preserving your family stories." />
        </Head>
        <Layout>
          <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
            <SupportContent />
          </Container>
        </Layout>
      </>
    )
  }

  // If the user is logged out, show the support form inside the public landing layout
  return (
    <>
      <Head>
        <title>Support & Contact - Heard Again</title>
        <meta name="description" content="Contact the Heard Again support team for help preserving your family stories." />
      </Head>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: ProfileColors.surface,
        }}
      >
        <PublicHeader />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: { xs: 2, sm: 3 },
            py: { xs: 6, md: 10 },
          }}
        >
          <Container maxWidth="md">
            <SupportContent />
          </Container>
        </Box>

        {/* Muted Footer */}
        <Box
          component="footer"
          sx={{
            bgcolor: ProfileColors.surfaceContainerLow,
            borderTop: '1px solid rgba(22, 51, 74, 0.08)',
            py: 4,
            textAlign: 'center',
            mt: 'auto',
          }}
        >
          <Container maxWidth="lg">
            <Typography variant="body2" sx={{ color: ProfileColors.onSecondaryContainer }}>
              © {new Date().getFullYear()} Heard Again. All rights reserved.
            </Typography>
          </Container>
        </Box>
      </Box>
    </>
  )
}
