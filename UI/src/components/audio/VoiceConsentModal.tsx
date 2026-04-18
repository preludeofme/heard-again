'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
  Alert,
  Chip,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  Divider,
  CircularProgress,
  IconButton,
} from '@mui/material'
import {
  RecordVoiceOver as VoiceIcon,
  Warning as WarningIcon,
  Close as CloseIcon,
  Info as InfoIcon,
} from '@mui/icons-material'

interface VoiceConsentModalProps {
  open: boolean
  onClose: () => void
  personId: string
  personName: string
  voiceProfileId?: string
  onConsentRecorded: () => void
}

type ConsentType = 'SELF' | 'FAMILY_ATTESTATION' | 'ESTATE_REPRESENTATIVE' | 'OTHER'

export function VoiceConsentModal({
  open,
  onClose,
  personId,
  personName,
  voiceProfileId,
  onConsentRecorded,
}: VoiceConsentModalProps) {
  const [consentType, setConsentType] = useState<ConsentType>('SELF')
  const [attestationText, setAttestationText] = useState('')
  const [allowsGeneration, setAllowsGeneration] = useState(true)
  const [allowsCloudProcessing, setAllowsCloudProcessing] = useState(false)
  const [allowsSharing, setAllowsSharing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const handleSubmit = async () => {
    if (!agreedToTerms) {
      setError('You must agree to the terms to proceed')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/voice/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          personId,
          voiceProfileId,
          consentType,
          attestationText: attestationText.trim() || null,
          allowsGeneration,
          allowsCloudProcessing,
          allowsSharing,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to record consent')
      }

      onConsentRecorded()
      handleClose()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setConsentType('SELF')
      setAttestationText('')
      setAllowsGeneration(true)
      setAllowsCloudProcessing(false)
      setAllowsSharing(false)
      setAgreedToTerms(false)
      setError(null)
      onClose()
    }
  }

  const getConsentTypeDescription = (type: ConsentType) => {
    switch (type) {
      case 'SELF':
        return 'I am the person whose voice is being cloned and I consent to this use'
      case 'FAMILY_ATTESTATION':
        return 'I am a family member attesting that the person has given consent'
      case 'ESTATE_REPRESENTATIVE':
        return 'I am the legal representative of the estate and have authority to grant consent'
      case 'OTHER':
        return 'Other circumstances (please explain in the attestation field)'
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth aria-labelledby="voice-consent-dialog-title">
      <DialogTitle id="voice-consent-dialog-title" sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
        <VoiceIcon color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Voice Consent & Authorization
        </Typography>
        <IconButton onClick={handleClose} aria-label="Close dialog" sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* Warning Banner */}
        <Alert severity="warning" sx={{ mb: 3 }} icon={<WarningIcon />}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Important: AI-generated voice cloning requires explicit consent
          </Typography>
          <Typography variant="caption">
            By proceeding, you confirm that you have the legal right and authority to authorize
            the creation and use of this voice clone. This is a serious ethical and potentially
            legal matter.
          </Typography>
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Person Info */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(208, 227, 230, 0.2)', borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Voice Subject
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {personName}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Voice cloning authorization for this individual
          </Typography>
        </Box>

        {/* Consent Type */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <FormLabel sx={{ mb: 2, fontWeight: 600 }}>
            What is your relationship to the voice subject?
          </FormLabel>
          <RadioGroup
            value={consentType}
            onChange={(e) => setConsentType(e.target.value as ConsentType)}
          >
            {(['SELF', 'FAMILY_ATTESTATION', 'ESTATE_REPRESENTATIVE', 'OTHER'] as ConsentType[]).map(
              (type) => (
                <Box
                  key={type}
                  sx={{
                    mb: 2,
                    p: 2,
                    border: '1px solid',
                    borderColor: consentType === type ? 'primary.main' : 'divider',
                    borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'rgba(22, 51, 74, 0.02)',
                    },
                  }}
                  onClick={() => setConsentType(type)}
                >
                  <FormControlLabel
                    value={type}
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {type.replace(/_/g, ' ')}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {getConsentTypeDescription(type)}
                        </Typography>
                      </Box>
                    }
                    sx={{ m: 0, alignItems: 'flex-start' }}
                  />
                </Box>
              )
            )}
          </RadioGroup>
        </FormControl>

        {/* Attestation Text */}
        {consentType !== 'SELF' && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Please provide additional attestation details
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Explain your relationship and how consent was obtained..."
              value={attestationText}
              onChange={(e) => setAttestationText(e.target.value)}
              sx={{ mb: 1 }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              This information may be reviewed for compliance purposes
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 3 }} />

        {/* Usage Permissions */}
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
          Usage Permissions
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={allowsGeneration}
                onChange={(e) => setAllowsGeneration(e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Allow AI voice generation</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Generate speech using this voice for stories and conversations
                </Typography>
              </Box>
            }
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={allowsCloudProcessing}
                onChange={(e) => setAllowsCloudProcessing(e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Allow cloud processing</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Use cloud GPU resources for higher quality voice synthesis
                </Typography>
              </Box>
            }
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={allowsSharing}
                onChange={(e) => setAllowsSharing(e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Allow sharing with family members</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Other workspace members can use this voice for their stories
                </Typography>
              </Box>
            }
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Terms Agreement */}
        <Box
          sx={{
            p: 2,
            bgcolor: 'rgba(22, 51, 74, 0.05)',
            borderRadius: 2,
            border: '1px solid',
            borderColor: agreedToTerms ? 'success.main' : 'divider',
          }}
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="body2">
                I confirm that I have the legal right and authority to grant this consent. I
                understand that misuse of voice cloning technology may have legal and ethical
                consequences. I agree to Heard Again&apos;s Terms of Service and Privacy Policy
                regarding voice data.
              </Typography>
            }
          />
        </Box>

        {/* AI Disclosure */}
        <Alert severity="info" sx={{ mt: 3 }} icon={<InfoIcon />}>
          <Typography variant="caption">
            All AI-generated audio will be labeled as such. Voice profiles are stored securely
            and isolated to your workspace. You can revoke consent at any time from the voice
            profile settings.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting || !agreedToTerms}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
        >
          {isSubmitting ? 'Recording...' : 'Record Consent'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
