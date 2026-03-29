import Head from 'next/head'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { Shield, DeleteForever, Download } from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'

interface RetentionPolicy {
  audioRetentionDays: number
  transcriptRetentionDays: number
  inactiveStoryDraftRetentionDays: number
  purgeRevokedVoiceConsentsAfterDays: number
  autoDeleteFailedProcessingAfterDays: number
  deleteSourceAudioAfterProfileReady: boolean
  updatedAt: string | null
  updatedByUserId: string | null
}

const defaultPolicy: RetentionPolicy = {
  audioRetentionDays: 3650,
  transcriptRetentionDays: 3650,
  inactiveStoryDraftRetentionDays: 365,
  purgeRevokedVoiceConsentsAfterDays: 365,
  autoDeleteFailedProcessingAfterDays: 30,
  deleteSourceAudioAfterProfileReady: false,
  updatedAt: null,
  updatedByUserId: null,
}

export default function PrivacyPage() {
  const [policy, setPolicy] = useState<RetentionPolicy>(defaultPolicy)
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(true)
  const [isSavingPolicy, setIsSavingPolicy] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmationText, setConfirmationText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const loadPolicy = async () => {
      setIsLoadingPolicy(true)
      setError(null)

      try {
        const response = await fetch('/api/privacy/retention')
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to load privacy settings')
        }

        setPolicy({ ...defaultPolicy, ...(data.data?.policy || {}) })
      } catch (err: any) {
        setError(err.message || 'Failed to load privacy settings')
      } finally {
        setIsLoadingPolicy(false)
      }
    }

    loadPolicy()
  }, [])

  const updateNumberField = (field: keyof RetentionPolicy) => (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(event.target.value, 10)
    setPolicy((prev) => ({
      ...prev,
      [field]: Number.isNaN(parsed) ? 0 : parsed,
    }))
  }

  const canRequestDeletion = useMemo(() => confirmationText.trim() === 'DELETE MY ACCOUNT', [confirmationText])

  const handleSavePolicy = async () => {
    setIsSavingPolicy(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/privacy/retention', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioRetentionDays: policy.audioRetentionDays,
          transcriptRetentionDays: policy.transcriptRetentionDays,
          inactiveStoryDraftRetentionDays: policy.inactiveStoryDraftRetentionDays,
          purgeRevokedVoiceConsentsAfterDays: policy.purgeRevokedVoiceConsentsAfterDays,
          autoDeleteFailedProcessingAfterDays: policy.autoDeleteFailedProcessingAfterDays,
          deleteSourceAudioAfterProfileReady: policy.deleteSourceAudioAfterProfileReady,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update retention policy')
      }

      setPolicy((prev) => ({ ...prev, ...(data.data?.policy || {}) }))
      setSuccess('Privacy retention settings saved successfully.')
    } catch (err: any) {
      setError(err.message || 'Failed to update retention policy')
    } finally {
      setIsSavingPolicy(false)
    }
  }

  const handleExportData = async () => {
    setIsExporting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/export/json', { method: 'POST' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Export endpoint is not available yet')
      }

      setSuccess('Export job created successfully. Check export jobs for progress.')
    } catch (err: any) {
      setError(err.message || 'Failed to request data export')
    } finally {
      setIsExporting(false)
    }
  }

  const handlePermanentDeletion = async () => {
    if (!canRequestDeletion) return

    setIsDeleting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/privacy/permanent-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationText }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete account')
      }

      setSuccess('Permanent deletion request completed. Your session will end soon.')
      setConfirmationText('')
    } catch (err: any) {
      setError(err.message || 'Failed to perform permanent deletion')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Head>
        <title>Privacy Settings - Heard Again</title>
      </Head>
      <Layout>
        <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4', px: { xs: 3, md: 8 }, py: 6 }}>
          <Box sx={{ maxWidth: 920, mx: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Shield sx={{ color: '#16334a' }} />
              <Typography variant="h4" className="serif-font" sx={{ color: '#16334a', fontStyle: 'italic' }}>
                Privacy Settings
              </Typography>
            </Box>

            <Typography variant="body2" sx={{ color: '#546669', mb: 4 }}>
              Manage retention, disclosure, and account-level privacy controls for your archive.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 3 }}>
                {success}
              </Alert>
            )}

            <Stack spacing={3}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 700, mb: 2 }}>
                    AI Disclosure Notices
                  </Typography>
                  <Stack spacing={1.5}>
                    <Alert severity="info">
                      All synthesized voice output is explicitly marked as AI-generated audio.
                    </Alert>
                    <Alert severity="info">
                      Voice generation requires active consent for person-linked voice profiles.
                    </Alert>
                    <Alert severity="warning">
                      Revoke consent at any time to immediately block future generation.
                    </Alert>
                  </Stack>
                </CardContent>
              </Card>

              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 700, mb: 2 }}>
                    Data Retention Policy
                  </Typography>

                  {isLoadingPolicy ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Audio Retention (days)"
                            value={policy.audioRetentionDays}
                            onChange={updateNumberField('audioRetentionDays')}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Transcript Retention (days)"
                            value={policy.transcriptRetentionDays}
                            onChange={updateNumberField('transcriptRetentionDays')}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Inactive Draft Retention (days)"
                            value={policy.inactiveStoryDraftRetentionDays}
                            onChange={updateNumberField('inactiveStoryDraftRetentionDays')}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Revoked Consent Retention (days)"
                            value={policy.purgeRevokedVoiceConsentsAfterDays}
                            onChange={updateNumberField('purgeRevokedVoiceConsentsAfterDays')}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Failed Processing Retention (days)"
                            value={policy.autoDeleteFailedProcessingAfterDays}
                            onChange={updateNumberField('autoDeleteFailedProcessingAfterDays')}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <FormControlLabel
                            sx={{ mt: 1 }}
                            control={
                              <Switch
                                checked={policy.deleteSourceAudioAfterProfileReady}
                                onChange={(event) =>
                                  setPolicy((prev) => ({
                                    ...prev,
                                    deleteSourceAudioAfterProfileReady: event.target.checked,
                                  }))
                                }
                              />
                            }
                            label="Delete source audio once profile is ready"
                          />
                        </Grid>
                      </Grid>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
                        <Typography variant="caption" sx={{ color: '#7c8688' }}>
                          {policy.updatedAt
                            ? `Last updated: ${new Date(policy.updatedAt).toLocaleString()}`
                            : 'Using default retention policy'}
                        </Typography>
                        <Button variant="contained" onClick={handleSavePolicy} disabled={isSavingPolicy}>
                          {isSavingPolicy ? 'Saving...' : 'Save Policy'}
                        </Button>
                      </Box>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 700, mb: 2 }}>
                    Data Export & Deletion Tools
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: '#16334a' }}>
                        Request JSON Data Export
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#546669' }}>
                        Generate an export package of your archive data.
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      startIcon={<Download />}
                      onClick={handleExportData}
                      disabled={isExporting}
                    >
                      {isExporting ? 'Requesting...' : 'Request Export'}
                    </Button>
                  </Box>

                  <Divider sx={{ my: 2.5 }} />

                  <Typography variant="subtitle2" sx={{ color: '#8f1d1d', fontWeight: 700 }}>
                    Permanent Account Deletion (GDPR)
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#6b2a2a', mt: 0.5, mb: 2 }}>
                    This permanently removes account credentials and redacts personal profile fields. This action cannot be undone.
                  </Typography>

                  <TextField
                    fullWidth
                    placeholder="Type DELETE MY ACCOUNT to confirm"
                    value={confirmationText}
                    onChange={(event) => setConfirmationText(event.target.value)}
                    sx={{ mb: 2 }}
                  />

                  <Button
                    color="error"
                    variant="contained"
                    startIcon={<DeleteForever />}
                    onClick={handlePermanentDeletion}
                    disabled={!canRequestDeletion || isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Permanently Delete My Account'}
                  </Button>
                </CardContent>
              </Card>
            </Stack>
          </Box>
        </Box>
      </Layout>
    </>
  )
}
