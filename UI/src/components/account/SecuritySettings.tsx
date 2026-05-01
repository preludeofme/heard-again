import React, { useState, useEffect } from 'react'
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
} from '@mui/material'
import {
  Security,
  VpnKey,
  QrCode,
  CheckCircle,
  ContentCopy,
  Info,
} from '@mui/icons-material'

export function SecuritySettings() {
  const [isLoading, setIsLoading] = useState(true)
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Setup state
  const [setupStep, setSetupStep] = useState<'INITIAL' | 'QR_CODE' | 'VERIFY'>('INITIAL')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verificationCode, setVerificationCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

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
    } catch (err: any) {
      setError('Failed to load MFA status')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartSetup = async () => {
    setError(null)
    setIsVerifying(true)
    try {
      const res = await fetch('/api/user/mfa', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start MFA setup')
      
      setQrCodeUrl(data.qrCode)
      setBackupCodes(data.backupCodes || [])
      setSetupStep('QR_CODE')
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
      const res = await fetch('/api/user/mfa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: verificationCode }),
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      
      setSuccess('MFA enabled successfully')
      setMfaEnabled(true)
      setSetupStep('INITIAL')
      setVerificationCode('')
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
      const res = await fetch('/api/user/mfa', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Failed to disable MFA')
      
      setSuccess('MFA disabled successfully')
      setMfaEnabled(false)
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
              <Typography variant="h6">Multi-Factor Authentication (MFA)</Typography>
              <Typography variant="body2" color="text.secondary">
                Add an extra layer of security to your account using TOTP (Time-based One-Time Password).
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {mfaEnabled ? (
            <Box>
              <Alert icon={<CheckCircle fontSize="inherit" />} severity="success" sx={{ mb: 3 }}>
                Two-factor authentication is currently enabled.
              </Alert>
              <Typography variant="body2" sx={{ mb: 3 }}>
                Your account is protected by an additional security layer. You will be prompted for a verification code when performing sensitive operations.
              </Typography>
              <Button
                variant="outlined"
                color="error"
                onClick={() => setIsDisableDialogOpen(true)}
              >
                Disable MFA
              </Button>
            </Box>
          ) : (
            <Box>
              {setupStep === 'INITIAL' && (
                <>
                  <Typography variant="body2" sx={{ mb: 3 }}>
                    MFA is not currently enabled for your account. We strongly recommend enabling it to protect your family's story.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={isVerifying ? <CircularProgress size={20} color="inherit" /> : <VpnKey />}
                    onClick={handleStartSetup}
                    disabled={isVerifying}
                  >
                    Set Up MFA
                  </Button>
                </>
              )}

              {setupStep === 'QR_CODE' && (
                <Stack spacing={3}>
                  <Alert severity="info" icon={<Info />}>
                    Scan the QR code below using an authenticator app (like Google Authenticator, Authy, or Bitwarden).
                  </Alert>

                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, bgcolor: 'white', borderRadius: 2 }}>
                    <img src={qrCodeUrl} alt="MFA QR Code" style={{ width: 200, height: 200 }} />
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Backup Codes</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Save these codes in a safe place. They can be used to access your account if you lose access to your authenticator app.
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: '#f5f5f5', mb: 2, position: 'relative' }}>
                      <Grid container spacing={1}>
                        {backupCodes.map((code, i) => (
                          <Grid item xs={6} key={i}>
                            <Typography sx={{ fontFamily: 'monospace' }}>{code}</Typography>
                          </Grid>
                        ))}
                      </Grid>
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
                      Next: Verify Code
                    </Button>
                    <Button variant="text" onClick={() => setSetupStep('INITIAL')}>
                      Cancel
                    </Button>
                  </Box>
                </Stack>
              )}

              {setupStep === 'VERIFY' && (
                <Stack spacing={3}>
                  <Typography variant="body2">
                    Enter the 6-digit code from your authenticator app to complete the setup.
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
                      Enable MFA
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
        <DialogTitle>Disable MFA?</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 3 }}>
            To disable MFA, please enter your password for security verification.
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
