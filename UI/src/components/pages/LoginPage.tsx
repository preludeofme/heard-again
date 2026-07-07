import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { signIn } from 'next-auth/react'
import {
  Box,
  Typography,
  Button,
  Container,
  Grid,
  Card,
  TextField,
  InputAdornment,
  IconButton,
  Divider,
  useTheme,
  Alert,
  CircularProgress,
} from '@mui/material'
import {
  Visibility,
  VisibilityOff,
  Security,
} from '@mui/icons-material'
import Link from 'next/link'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { MFAChallenge } from '@/components/auth/MFAChallenge'
import { AnimatedWaveform } from '../brand/AnimatedWaveform'

export function LoginPage() {
  const theme = useTheme()
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  // MFA challenge state
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaMethod, setMfaMethod] = useState<'totp' | 'email'>('email')
  const [mfaEmail, setMfaEmail] = useState('')

  // Get callback URL from query params, default to the unified memories home
  const callbackUrl = (router.query.callbackUrl as string) || '/legacy'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        // Check if this is an MFA_REQUIRED error
        if (result.error === 'MFA_REQUIRED') {
          // We need to detect the MFA method from the server
          // Since next-auth only returns error strings, we need a different approach
          // Let's check the user's MFA status via an API call
          const statusRes = await fetch('/api/user/mfa-status-by-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: formData.email }),
          })
          const statusData = await statusRes.json()

          if (statusData.mfaEnabled) {
            setMfaMethod(statusData.mfaMethod || 'email')
            setMfaEmail(statusData.email || formData.email)
            setMfaRequired(true)
            return
          }
        }

        throw new Error('Invalid email or password')
      }

      // Full reload forces NextAuth session state to be re-read from the server
      window.location.href = callbackUrl
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMFASuccess = async (tempToken: string, userId: string) => {
    // Now sign in with the tempToken
    setIsLoading(true)
    try {
      const result = await signIn('credentials', {
        email: mfaEmail,
        password: formData.password,
        mfaTempToken: tempToken,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        throw new Error('Authentication failed. Please try again.')
      }

      window.location.href = callbackUrl
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      setMfaRequired(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMFACancel = () => {
    setMfaRequired(false)
    setMfaEmail('')
  }

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl })
  }

  // If MFA is required, show the MFA challenge instead of the login form
  if (mfaRequired) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PublicHeader />
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
            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            <MFAChallenge
              email={mfaEmail}
              method={mfaMethod}
              onSuccess={handleMFASuccess}
              onCancel={handleMFACancel}
            />
          </Container>
        </Box>
      </Box>
    )
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
        <Container maxWidth="lg">
          <Grid container spacing={8} alignItems="center" justifyContent="center">
            {/* Left Side - Branding & Mission */}
            <Grid size={{ xs: 12, lg: 5 }}>
              <Box sx={{ spaceY: 4 }}>
                <Typography
                  variant="h1"
                  sx={{
                    fontSize: { xs: '2.5rem', md: '3.5rem' },
                    color: 'primary.main',
                    mb: 3,
                    fontFamily: 'var(--font-newsreader), serif',
                    fontWeight: 300,
                    lineHeight: 1.2,
                  }}
                >
                  Welcome{' '}
                  <Box component="span" sx={{ fontStyle: 'italic' }}>
                    Back.
                  </Box>
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    fontSize: '1.125rem',
                    color: 'secondary.main',
                    mb: 4,
                    maxWidth: 400,
                    lineHeight: 1.6,
                  }}
                >
                  Sign in to continue preserving your family&apos;s stories, voices, and memories for future generations.
                </Typography>

                {/* Trust Badge */}
                <Card
                  sx={{
                    bgcolor: 'rgba(208, 227, 230, 0.3)',
                    p: 3,
                    borderRadius: 3,
                    borderLeft: 4,
                    borderColor: 'primary.main',
                    display: 'flex',
                    gap: 2,
                    mb: 4,
                  }}
                >
                  <Security sx={{ color: 'primary.main', fontSize: 32 }} />
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        color: 'primary.main',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontSize: '0.75rem',
                        mb: 0.5,
                      }}
                    >
                      Secure Access
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'secondary.main' }}>
                      Your data is encrypted and protected. We never share your information with third parties.
                    </Typography>
                  </Box>
                </Card>

                {/* Vintage Image */}
                <Box
                  sx={{
                    display: { xs: 'none', lg: 'block' },
                    position: 'relative',
                    height: 200,
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    component="img"
                    src="https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=600&h=300&fit=crop"
                    alt="Family memories"
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      filter: 'grayscale(100%)',
                      mixBlendMode: 'multiply',
                      opacity: 0.8,
                      '&:hover': {
                        filter: 'grayscale(0%)',
                      },
                      transition: 'all 0.7s',
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      bgcolor: 'primary.main',
                      opacity: 0.1,
                    }}
                  />
                </Box>
              </Box>
            </Grid>

            {/* Right Side - Sign In Form */}
            <Grid size={{ xs: 12, lg: 7 }}>
              <Card
                sx={{
                  bgcolor: 'background.paper',
                  p: { xs: 4, md: 6 },
                  borderRadius: 6,
                  boxShadow: '0 10px 40px rgba(28, 28, 25, 0.06)',
                }}
              >
                <Box sx={{ mb: 4 }}>
                  <Typography
                    variant="h4"
                    sx={{
                      color: 'primary.main',
                      mb: 1,
                      fontFamily: 'var(--font-newsreader), serif',
                    }}
                  >
                    Sign In
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'secondary.main' }}>
                    Don&apos;t have an account?{' '}
                    <Link
                      href="/signup"
                      style={{
                        color: theme.palette.primary.main,
                        fontWeight: 600,
                        textDecoration: 'underline',
                        textUnderlineOffset: 4,
                      }}
                    >
                      Create one
                    </Link>
                  </Typography>
                </Box>

                {/* Error Alert */}
                {error && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                  </Alert>
                )}

                {/* Social Logins */}
                <Box sx={{ mb: 4 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    sx={{
                      py: 1.5,
                      borderColor: 'rgba(208, 227, 230, 0.5)',
                      color: 'text.primary',
                      '&:hover': {
                        bgcolor: 'rgba(208, 227, 230, 0.3)',
                        borderColor: 'rgba(208, 227, 230, 0.8)',
                      },
                    }}
                    startIcon={
                      <Box
                        component="img"
                        src="https://www.google.com/favicon.ico"
                        alt="Google"
                        sx={{ width: 20, height: 20 }}
                      />
                    }
                  >
                    Sign in with Google
                  </Button>
                </Box>

                <Divider sx={{ my: 4 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'secondary.main',
                      px: 2,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    Or continue with email
                  </Typography>
                </Divider>

                {/* Email Form */}
                <form onSubmit={handleSubmit}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <TextField
                      fullWidth
                      label="Email Address"
                      type="email"
                      placeholder="name@example.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      InputLabelProps={{ shrink: true }}
                    />

                    <TextField
                      fullWidth
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                            >
                              {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                    <Link
                      href="/forgot-password"
                      style={{
                        color: theme.palette.primary.main,
                        fontSize: '0.875rem',
                        textDecoration: 'underline',
                      }}
                    >
                      Forgot password?
                    </Link>
                  </Box>

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
                        'Sign In'
                      )}
                    </Button>
                  </Box>
                </form>
              </Card>
            </Grid>
          </Grid>
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
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <AnimatedWaveform height={24} sx={{ mb: 0.3 }} />
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
                © {new Date().getFullYear()} Heard Again. A sanctuary for identity.
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
              <Link href="/terms-legacy" style={{ textDecoration: 'none' }}>
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
              <Link href="/contact" style={{ textDecoration: 'none' }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'secondary.main',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  Contact Us
                </Typography>
              </Link>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  )
}
