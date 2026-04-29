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

  // Get callback URL from query params, default to the unified archive home
  const callbackUrl = (router.query.callbackUrl as string) || '/archive'

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
        throw new Error('Invalid email or password')
      }

      // Redirect on success
      router.push(callbackUrl)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl })
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
                  Sign in to continue preserving your family's stories, voices, and memories for future generations.
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
                    Don't have an account?{' '}
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
                <Grid container spacing={2} sx={{ mb: 4 }}>
                  <Grid size={{ xs: 12, md: 6 }}>
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
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Button
                      fullWidth
                      variant="outlined"
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
                      Sign in with Apple
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
                    sx={{ mb: 2 }}
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
