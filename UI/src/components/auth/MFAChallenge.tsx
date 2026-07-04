import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material'
import { Security } from '@mui/icons-material'

interface MFAChallengeProps {
  email: string
  method: 'totp' | 'email'
  onSuccess: (tempToken: string, userId: string) => void
  onCancel?: () => void
}

export function MFAChallenge({ email, method, onSuccess, onCancel }: MFAChallengeProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [codeSent, setCodeSent] = useState(method !== 'email')

  // Auto-send code for email method on mount
  useEffect(() => {
    if (method === 'email' && !codeSent) {
      handleResendCode()
    }
  }, [method])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleResendCode = useCallback(async () => {
    if (method !== 'email' || isResending || resendCooldown > 0) return

    setIsResending(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/mfa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-code', email }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send code')

      setCodeSent(true)
      setResendCooldown(60)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsResending(false)
    }
  }, [email, method, isResending, resendCooldown])

  const handleVerify = async () => {
    if (code.length !== 6) return

    setIsVerifying(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/mfa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', email, code }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid code')

      onSuccess(data.tempToken, data.userId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <Card sx={{ maxWidth: 450, mx: 'auto', mt: 4 }}>
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Security sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
          <Box>
            <Typography variant="h6">Sign in code needed</Typography>
            <Typography variant="body2" color="text.secondary">
              {method === 'email'
                ? 'We\'ll send a code to your email to keep your account safe.'
                : 'Use your authenticator app to get the code.'}
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {method === 'email' && codeSent && !isResending && (
          <Alert severity="info" sx={{ mb: 3 }}>
            A code has been sent to <strong>{email}</strong>. Check your inbox (and spam folder).
          </Alert>
        )}

        <Typography variant="body2" sx={{ mb: 2, fontWeight: 500 }}>
          {method === 'email'
            ? 'Enter the 6-digit code from the email:'
            : 'Enter the 6-digit code from your authenticator app:'}
        </Typography>

        <TextField
          label="Verification Code"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
          fullWidth
          autoFocus
          sx={{ mb: 3 }}
          inputProps={{
            inputMode: 'numeric',
            pattern: '[0-9]*',
            autoComplete: 'one-time-code',
          }}
        />

        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={handleVerify}
          disabled={code.length !== 6 || isVerifying}
          startIcon={isVerifying ? <CircularProgress size={20} color="inherit" /> : null}
          sx={{ mb: 2, py: 1.5 }}
        >
          {isVerifying ? 'Verifying...' : 'Verify'}
        </Button>

        {method === 'email' && (
          <Box sx={{ textAlign: 'center' }}>
            <Button
              variant="text"
              onClick={handleResendCode}
              disabled={isResending || resendCooldown > 0}
              size="small"
            >
              {isResending
                ? 'Sending...'
                : resendCooldown > 0
                  ? `Resend code (${resendCooldown}s)`
                  : 'Resend code'}
            </Button>
          </Box>
        )}

        {onCancel && (
          <Box sx={{ textAlign: 'center', mt: 1 }}>
            <Button variant="text" color="error" onClick={onCancel} size="small">
              Cancel
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
