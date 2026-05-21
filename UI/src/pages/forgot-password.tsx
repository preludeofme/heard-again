import React, { useState } from 'react'
import { useRouter } from 'next/router'
import {
  Box,
  Typography,
  Button,
  Container,
  Card,
  TextField,
  useTheme,
  Alert,
  CircularProgress,
} from '@mui/material'
import { ArrowBack, Email } from '@mui/icons-material'
import Link from 'next/link'
import { PublicHeader } from '@/components/layout/PublicHeader'

export default function ForgotPasswordPage() {
  const theme = useTheme()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email')
      }

      setIsSuccess(true)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicHeader />

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 3, md: 6 },
          py: { xs: 6, md: 10 },
        }}
      >
        <Container maxWidth="sm">
          <Card
            sx={{
              bgcolor: 'background.paper',
              p: { xs: 4, md: 6 },
              borderRadius: 6,
              boxShadow: '0 10px 40px rgba(28, 28, 25, 0.06)',
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
                  mb: 3,
                }}
              >
                <Email sx={{ fontSize: 32, color: 'primary.main' }} />
              </Box>
              <Typography
                variant="h4"
                sx={{
                  color: 'primary.main',
                  mb: 1,
                  fontFamily: 'var(--font-newsreader), serif',
                }}
              >
                Reset Your Password
              </Typography>
              <Typography variant="body2" sx={{ color: 'secondary.main' }}>
                Enter your email address and we&apos;ll send you instructions to reset your password.
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {isSuccess ? (
              <Box sx={{ textAlign: 'center' }}>
                <Alert severity="success" sx={{ mb: 3 }}>
                  If an account exists with this email, you will receive password reset instructions shortly.
                </Alert>
                <Typography variant="body2" sx={{ color: 'secondary.main', mb: 3 }}>
                  Please check your email inbox and spam folder for the reset link.
                </Typography>
                <Button
                  component={Link}
                  href="/login"
                  variant="contained"
                  fullWidth
                  sx={{
                    py: 2,
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
                  }}
                >
                  Return to Sign In
                </Button>
              </Box>
            ) : (
              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  label="Email Address"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  sx={{ mb: 3 }}
                  required
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={isLoading}
                  sx={{
                    py: 2,
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
                  }}
                >
                  {isLoading ? (
                    <CircularProgress size={24} sx={{ color: 'white' }} />
                  ) : (
                    'Send Reset Instructions'
                  )}
                </Button>

                <Box sx={{ mt: 3, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: 'secondary.main' }}>
                    Remember your password?{' '}
                    <Link
                      href="/login"
                      style={{
                        color: theme.palette.primary.main,
                        fontWeight: 600,
                        textDecoration: 'underline',
                      }}
                    >
                      Sign In
                    </Link>
                  </Typography>
                </Box>
              </Box>
            )}
          </Card>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          bgcolor: 'rgba(208, 227, 230, 0.3)',
          py: 4,
          px: { xs: 4, md: 8 },
          mt: 'auto',
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'var(--font-newsreader), serif',
                  fontStyle: 'italic',
                  color: 'primary.main',
                }}
              >
                Heard Again
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'secondary.main', display: 'block' }}
              >
                © 2024 Heard Again. A sanctuary for identity.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
              <Link href="/privacy" style={{ textDecoration: 'none' }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'secondary.main',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  Privacy Policy
                </Typography>
              </Link>
              <Link href="/terms" style={{ textDecoration: 'none' }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'secondary.main',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  Terms of Legacy
                </Typography>
              </Link>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  )
}


export async function getServerSideProps() { return { props: {} } }
