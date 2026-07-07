import React, { useState, useEffect } from 'react'
import { fetchWithCSRF } from '@/lib/api-client'
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Paper,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material'
import {
  Security,
  VpnKey,
  QrCode,
  CheckCircle,
  ContentCopy,
  Info,
  Email,
  Smartphone,
} from '@mui/icons-material'

export function SecuritySettings() {
  const [isLoading, setIsLoading] = useState(true)
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaMethod, setMfaMethod] = useState<'totp' | 'email' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Setup state
  const [setupStep, setSetupStep] = useState<'INITIAL' | 'CHOOSE_METHOD' | 'QR_CODE' | 'VERIFY' | 'EMAIL_SENT' | 'EMAIL_VERIFY'>('INITIAL')
  const [selectedMethod, setSelectedMethod] = useState<'totp' | 'email'>('email')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verificationCode, setVerificationCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  // Email-specific state
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  // Disable state
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [isDisabling, setIsDisabling] = useState(false)

  useEffect(() => {
    fetchMfaStatus()
  }, [])

  const fetchMfaStatus = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/user/mfa', { credentials: 'include' })
      const data = await res.json()
      setMfaEnabled(data.enabled)
      setMfaMethod(data.method || null)

      // Also fetch user email for display
      const sessionRes = await fetch('/api/auth/session')
      const sessionData = await sessionRes.json()
      if (sessionData?.user?.email) {
        setUserEmail(sessionData.user.email)
      }
    } catch (err: any) {
      setError('Failed to load MFA status')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartSetup = () => {
    setSetupStep('CHOOSE_METHOD')
    setSelectedMethod('email') // Default to recommended simpler method
    setError(null)
  }

  const handleMethodSelected = async () => {
    setError(null)
    setIsVerifying(true)
    try {
      const res = await fetchWithCSRF('/api/user/mfa', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: selectedMethod }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start MFA setup')

      if (selectedMethod === 'email') {
        setEmailCodeSent(true)
        setSetupStep('EMAIL_SENT')
      } else {
        setQrCodeUrl(data.qrCode)
        setBackupCodes(data.backupCodes || [])
        setSetupStep('QR_CODE')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleVerifySetup = async () => {
    if (!verificationCode) return

    setError(null)
    setIsVerifying(true)
    try {
      const res = await fetchWithCSRF('/api/user/mfa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: verificationCode }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Verification failed')

      setSuccess('Login code turned on successfully')
      setMfaEnabled(true)
      setMfaMethod(selectedMethod)
      setSetupStep('INITIAL')
      setVerificationCode('')
      setEmailCodeSent(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleDisableMFA = async () => {
    if (!password) return

    setError(null)
    setIsDisabling(true)
    try {
      const res = await fetchWithCSRF('/api/user/mfa', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to disable MFA')

      setSuccess('Login code turned off successfully')
      setMfaEnabled(false)
      setMfaMethod(null)
      setIsDisableDialogOpen(false)
      setPassword('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsDisabling(false)
    }
  }

  const copyBackupCodes = () => {
    const text = backupCodes.join('\n')
    navigator.clipboard.writeText(text)
    setSuccess('Backup codes copied to clipboard')
  }

  const handleCancelSetup = () => {
    setSetupStep('INITIAL')
    setVerificationCode('')
    setEmailCodeSent(false)
    setError(null)
  }

  if (isLoading) {
    return <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />
  }

  return (
    <Box sx={{ maxWidth: 800 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Security sx={{ mr: 2, color: 'primary.main' }} />
            <Box>
              <Typography variant="h6">Login code (recommended)</Typography>
              <Typography variant="body2" color="text.secondary">
                Adds a check to keep your family&apos;s stories safe.
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {mfaEnabled ? (
            <Box>
              <Alert icon={<CheckCircle fontSize="inherit" />} severity="success" sx={{ mb: 3 }}>
                Login code is turned on.
              </Alert>
              <Typography variant="body2" sx={{ mb: 1 }}>
                A code will be sent to your email when you sign in.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Method: <strong>{mfaMethod === 'email' ? 'Email code' : 'Authenticator app'}</strong>
              </Typography>
              <Button
                variant="outlined"
                color="error"
                onClick={() => setIsDisableDialogOpen(true)}
              >
                Turn off login code
              </Button>
            </Box>
          ) : (
            <Box>
              {setupStep === 'INITIAL' && (
                <>
                  <Typography variant="body2" sx={{ mb: 3 }}>
                    A login code isn&apos;t set up yet. We recommend turning it on — it helps keep your family&apos;s stories safe.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<VpnKey />}
                    onClick={handleStartSetup}
                  >
                    Set Up Login Code
                  </Button>
                </>
              )}

              {setupStep === 'CHOOSE_METHOD' && (
                <Stack spacing={3}>
                  <Typography variant="body1" fontWeight={600}>
                    How should we send you the code?
                  </Typography>

                  <RadioGroup
                    value={selectedMethod}
                    onChange={(e) => setSelectedMethod(e.target.value as 'totp' | 'email')}
                  >
                    <Paper
                      sx={{
                        p: 2,
                        mb: 2,
                        border: '2px solid',
                        borderColor: selectedMethod === 'email' ? 'primary.main' : 'divider',
                        bgcolor: selectedMethod === 'email' ? 'rgba(22, 51, 74, 0.04)' : 'transparent',
                        cursor: 'pointer',
                        '&:hover': { borderColor: 'primary.light' },
                      }}
                      onClick={() => setSelectedMethod('email')}
                    >
                      <FormControlLabel
                        value="email"
                        control={<Radio />}
                        label={
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Email color="primary" />
                              <Typography variant="subtitle1" fontWeight={600}>
                                Email me a code (recommended)
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, ml: 5 }}>
                              When you sign in, we&apos;ll send a code to <strong>{userEmail || 'your email'}</strong>. Easy — no app to install.
                            </Typography>
                          </Box>
                        }
                        sx={{ alignItems: 'flex-start', width: '100%' }}
                      />
                    </Paper>

                    <Paper
                      sx={{
                        p: 2,
                        border: '2px solid',
                        borderColor: selectedMethod === 'totp' ? 'primary.main' : 'divider',
                        bgcolor: selectedMethod === 'totp' ? 'rgba(22, 51, 74, 0.04)' : 'transparent',
                        cursor: 'pointer',
                        '&:hover': { borderColor: 'primary.light' },
                      }}
                      onClick={() => setSelectedMethod('totp')}
                    >
                      <FormControlLabel
                        value="totp"
                        control={<Radio />}
                        label={
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Smartphone color="primary" />
                              <Typography variant="subtitle1" fontWeight={600}>
                                Use an authenticator app
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, ml: 5 }}>
                              Scan a QR code with an authenticator app. You&apos;ll get backup codes you can save in case you lose the app.
                            </Typography>
                          </Box>
                        }
                        sx={{ alignItems: 'flex-start', width: '100%' }}
                      />
                    </Paper>
                  </RadioGroup>

                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="contained"
                      onClick={handleMethodSelected}
                      disabled={isVerifying}
                      startIcon={isVerifying ? <CircularProgress size={20} color="inherit" /> : null}
                    >
                      {isVerifying ? 'Setting up...' : selectedMethod === 'email' ? 'Send Code' : 'Continue'}
                    </Button>
                    <Button variant="text" onClick={handleCancelSetup}>
                      Cancel
                    </Button>
                  </Box>
                </Stack>
              )}

              {setupStep === 'EMAIL_SENT' && (
                <Stack spacing={3}>
                  <Alert severity="info" icon={<Email />}>
                    A code has been sent to <strong>{userEmail}</strong>. It expires in 5 minutes.
                  </Alert>

                  <Typography variant="body2">
                    Enter the 6-digit code from the email to finish setup.
                  </Typography>

                  <TextField
                    label="Verification Code"
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                    fullWidth
                    sx={{ maxWidth: 300 }}
                    autoFocus
                    inputProps={{
                      inputMode: 'numeric',
                      pattern: '[0-9]*',
                      autoComplete: 'one-time-code',
                    }}
                  />

                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="contained"
                      onClick={handleVerifySetup}
                      disabled={verificationCode.length !== 6 || isVerifying}
                      startIcon={isVerifying ? <CircularProgress size={20} color="inherit" /> : null}
                    >
                      Turn on login code
                    </Button>
                    <Button
                      variant="text"
                      onClick={handleMethodSelected}
                      disabled={isVerifying}
                    >
                      Resend code
                    </Button>
                    <Button variant="text" onClick={() => setSetupStep('CHOOSE_METHOD')}>
                      Back
                    </Button>
                  </Box>
                </Stack>
              )}

              {setupStep === 'QR_CODE' && (
                <Stack spacing={3}>
                  <Alert severity="info" icon={<Info />}>
                    Scan the QR code below with an authenticator app.
                  </Alert>

                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, bgcolor: 'white', borderRadius: 2 }}>
                    <img src={qrCodeUrl} alt="QR code" style={{ width: 200, height: 200 }} />
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Backup Codes</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Save these somewhere you can find them — your notes app or password manager works. You&apos;ll need them if you lose the authenticator app.
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: '#f5f5f5', mb: 2, position: 'relative' }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                        {backupCodes.map((code, i) => (
                          <Typography key={i} sx={{ fontFamily: 'monospace' }}>{code}</Typography>
                        ))}
                      </Box>
                      <Button
                        size="small"
                        startIcon={<ContentCopy />}
                        sx={{ position: 'absolute', top: 8, right: 8 }}
                        onClick={copyBackupCodes}
                      >
                        Copy
                      </Button>
                    </Paper>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button variant="contained" onClick={() => setSetupStep('VERIFY')}>
                      Next: Verify code
                    </Button>
                    <Button variant="text" onClick={handleCancelSetup}>
                      Cancel
                    </Button>
                  </Box>
                </Stack>
              )}

              {setupStep === 'VERIFY' && (
                <Stack spacing={3}>
                  <Typography variant="body2">
                    Enter the 6-digit code from your authenticator app.
                  </Typography>
                  <TextField
                    label="Verification Code"
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                    fullWidth
                    sx={{ maxWidth: 300 }}
                    autoFocus
                  />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="contained"
                      onClick={handleVerifySetup}
                      disabled={verificationCode.length !== 6 || isVerifying}
                      startIcon={isVerifying ? <CircularProgress size={20} color="inherit" /> : null}
                    >
                      Turn on login code
                    </Button>
                    <Button variant="text" onClick={() => setSetupStep('QR_CODE')}>
                      Back
                    </Button>
                  </Box>
                </Stack>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Disable MFA Dialog */}
      <Dialog open={isDisableDialogOpen} onClose={() => !isDisabling && setIsDisableDialogOpen(false)}>
        <DialogTitle>Turn off login code?</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 3 }}>
            Enter your password to turn off the login code.
          </Typography>
          <TextField
            fullWidth
            type="password"
            label="Account Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isDisabling}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDisableDialogOpen(false)} disabled={isDisabling}>
            Cancel
          </Button>
          <Button
            onClick={handleDisableMFA}
            color="error"
            disabled={!password || isDisabling}
            startIcon={isDisabling ? <CircularProgress size={20} color="inherit" /> : null}
          >
            Disable
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
