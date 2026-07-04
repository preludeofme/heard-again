import React, { useState, useEffect } from 'react'
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
  InputAdornment,
  IconButton,
} from '@mui/material'
import { ArrowBack, Lock, Visibility, VisibilityOff, CheckCircle } from '@mui/icons-material'
import Link from 'next/link'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { AnimatedWaveform } from '@/components/brand/AnimatedWaveform'

export default function ResetPasswordPage() {
  const theme = useTheme()
  const router = useRouter()
  const { token } = router.query

  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })

  // Verify token on page load
  useEffect(() => {
    if (!router.isReady) return

    const resetToken = Array.isArray(token) ? token[0] : token

    if (!resetToken) {
      setError('No reset token provided. Please use the link from your password reset email.')
      setIsVerifying(false)
      return
    }

    const verifyToken = async () => {
      try {
        const response = await fetch('/api/auth/verify-reset-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Invalid or expired token')
        }

        setEmail(data.email)
        setIsVerifying(false)
      } catch (err: any) {
        setError(err.message || 'This password reset link is invalid or has expired.')
        setIsVerifying(false)
      }
    }

    verifyToken()
  }, [router.isReady, token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password length
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    const resetToken = Array.isArray(token) ? token[0] : token
    if (!resetToken) {
      setError('No reset token provided. Please use the link from your password reset email.')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken,
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password')
      }

      setIsSuccess(true)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (isVerifying) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
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
        <Container maxWidth="sm">
          <Card
            sx={{
              bgcolor: 'background.paper',
              p: { xs: 4, md: 6 },
              borderRadius: 6,
              boxShadow: '0 10px 40px rgba(28, 28, 25, 0.06)',
            }}
          >
            {isSuccess ? (
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    bgcolor: 'success.light',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 3,
                  }}
                >
                  <CheckCircle sx={{ fontSize: 32, color: 'success.main' }} />
                </Box>
                <Typography
                  variant="h4"
                  sx={{
                    color: 'primary.main',
                    mb: 2,
                    fontFamily: 'var(--font-newsreader), serif',
                  }}
                >
                  Password Reset Complete
                </Typography>
                <Typography variant="body1" sx={{ color: 'secondary.main', mb: 4 }}>
                  Your password has been successfully reset. You can now sign in with your new password.
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
                  Sign In with New Password
                </Button>
              </Box>
            ) : error && !formData.password ? (
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    bgcolor: 'error.light',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 3,
                  }}
                >
                  <Lock sx={{ fontSize: 32, color: 'error.main' }} />
                </Box>
                <Typography
                  variant="h4"
                  sx={{
                    color: 'primary.main',
                    mb: 2,
                    fontFamily: 'var(--font-newsreader), serif',
                  }}
                >
                  Link Expired
                </Typography>
                <Alert severity="error" sx={{ mb: 4, textAlign: 'left' }}>
                  {error}
                </Alert>
                <Button
                  component={Link}
                  href="/forgot-password"
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
                  Request New Reset Link
                </Button>
              </Box>
            ) : (
              <>
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
                    <Lock sx={{ fontSize: 32, color: 'primary.main' }} />
                  </Box>
                  <Typography
                    variant="h4"
                    sx={{
                      color: 'primary.main',
                      mb: 1,
                      fontFamily: 'var(--font-newsreader), serif',
                    }}
                  >
                    Create New Password
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'secondary.main' }}>
                    Enter a new password for{' '}
                    <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {email}
                    </Box>
                  </Typography>
                </Box>

                {error && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                  </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit}>
                  <TextField
                    fullWidth
                    label="New Password"
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
                    sx={{ mb: 3 }}
                    required
                  />

                  <TextField
                    fullWidth
                    label="Confirm New Password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, confirmPassword: e.target.value })
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            edge="end"
                          >
                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ mb: 1 }}
                    required
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
                      'Reset Password'
                    )}
                  </Button>
                </Box>
              </>
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
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  )
}


export async function getServerSideProps() { return { props: {} } }
