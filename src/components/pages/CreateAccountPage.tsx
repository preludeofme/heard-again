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
import { fetchWithCSRFAndJSON } from '@/lib/api-client'

export function CreateAccountPage() {
  const theme = useTheme()
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Call signup API with CSRF protection
      const response = await fetchWithCSRFAndJSON('/api/auth/signup', {
        email: formData.email,
        password: formData.password,
        displayName: formData.fullName,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details?.email || data.details?.password || 'Failed to create account')
      }

      // Automatically sign in after successful signup
      const signInResult = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (signInResult?.error) {
        throw new Error('Account created but failed to sign in')
      }

      // Redirect to onboarding on success (middleware will verify completion)
      router.push('/onboarding')
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignUp = () => {
    signIn('google', { callbackUrl: '/dashboard' })
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        component="header"
        sx={{
          bgcolor: 'background.default',
          borderBottom: '1px solid',
          borderColor: 'rgba(208, 227, 230, 0.5)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              py: 2,
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontFamily: 'var(--font-newsreader), serif',
                fontStyle: 'italic',
                color: 'primary.main',
                fontSize: '1.5rem',
              }}
            >
              Heard Again
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                component={Link}
                href="/login"
                variant="text"
                sx={{ color: 'secondary.main' }}
              >
                Sign In
              </Button>
              <Button
                component={Link}
                href="/signup"
                variant="contained"
              >
                Start Archive
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

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
          <Grid container spacing={8} alignItems="center">
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
                  Begin your{' '}
                  <Box component="span" sx={{ fontStyle: 'italic' }}>
                    Digital Heirloom.
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
                  Your voice is your most personal signature. We provide a sanctuary to preserve your stories, wisdom, and essence for generations to come.
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
                      Privacy First
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'secondary.main' }}>
                      Your data is encrypted and never sold. We are stewards of your legacy, not owners of your identity.
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
                    src="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=600&h=300&fit=crop"
                    alt="Vintage microphone"
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

            {/* Right Side - Sign Up Form */}
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
                    Create Your Account
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'secondary.main' }}>
                    Already have an archive?{' '}
                    <Link
                      href="/login"
                      style={{
                        color: theme.palette.primary.main,
                        fontWeight: 600,
                        textDecoration: 'underline',
                        textUnderlineOffset: 4,
                      }}
                    >
                      Sign In
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
                <Grid container spacing={2} sx={{ mb: 4 }}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={handleGoogleSignUp}
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
                      Sign up with Google
                    </Button>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Button
                      fullWidth
                      variant="outlined"
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
                        <Typography
                          component="span"
                          sx={{
                            fontFamily: '"Material Symbols Outlined", sans-serif',
                            fontVariationSettings: "'FILL' 1, 'wght' 400",
                            fontSize: 20,
                          }}
                        >
                          apple
                        </Typography>
                      }
                    >
                      Sign up with Apple
                    </Button>
                  </Grid>
                </Grid>

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
                <Box component="form" onSubmit={handleSubmit} sx={{ spaceY: 3 }}>
                  <TextField
                    fullWidth
                    label="Full Name"
                    placeholder="Johnathan Doe"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    sx={{ mb: 3 }}
                  />

                  <TextField
                    fullWidth
                    label="Email Address"
                    type="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    sx={{ mb: 3 }}
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
                    sx={{ mb: 1 }}
                  />
                  <Typography
                    variant="caption"
                    sx={{ color: 'secondary.main', display: 'block', mb: 3 }}
                  >
                    Must be at least 8 characters with a number.
                  </Typography>

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
                      'Start My Living Archive'
                    )}
                  </Button>

                  <Typography
                    variant="caption"
                    sx={{
                      color: 'secondary.main',
                      textAlign: 'center',
                      display: 'block',
                      mt: 3,
                      px: 2,
                    }}
                  >
                    By creating an account, you agree to our{' '}
                    <Link
                      href="/terms"
                      style={{ color: theme.palette.primary.main, textDecoration: 'underline' }}
                    >
                      Terms of Legacy
                    </Link>{' '}
                    and{' '}
                    <Link
                      href="/privacy"
                      style={{ color: theme.palette.primary.main, textDecoration: 'underline' }}
                    >
                      Privacy Policy
                    </Link>
                    .
                  </Typography>
                </Box>
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
