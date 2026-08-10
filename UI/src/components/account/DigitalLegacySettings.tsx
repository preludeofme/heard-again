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
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Paper,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material'
import {
  SafetyCheck,
  PersonAdd,
  HourglassEmpty,
  CheckCircle,
  Warning,
  Cancel,
  UploadFile,
  VerifiedUser,
} from '@mui/icons-material'

export function DigitalLegacySettings() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Legacy successor data
  const [successor, setSuccessor] = useState<any | null>(null)
  const [successorStatus, setSuccessorStatus] = useState<string | null>(null)
  const [invitations, setInvitations] = useState<any[]>([])

  // Claims data
  const [initiatedClaims, setInitiatedClaims] = useState<any[]>([])
  const [claimsAgainstMe, setClaimsAgainstMe] = useState<any[]>([])
  const [pendingAdminReview, setPendingAdminReview] = useState<any[]>([])

  // Form states
  const [designateEmail, setDesignateEmail] = useState('')
  const [isSubmittingDesignate, setIsSubmittingDesignate] = useState(false)

  // Initiate claim dialog states
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false)
  const [claimEmail, setClaimEmail] = useState('')
  const [proofType, setProofType] = useState<'OBITUARY_LINK' | 'DEATH_CERTIFICATE'>('OBITUARY_LINK')
  const [proofData, setProofData] = useState('')
  const [claimNotes, setClaimNotes] = useState('')
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false)

  // User role details
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // 1. Fetch user session to determine role
      const sessionRes = await fetch('/api/auth/session')
      const sessionData = await sessionRes.json()
      if (sessionData?.user?.userRole === 'ADMIN' || sessionData?.user?.role === 'ADMIN') {
        setIsAdmin(true)
      }

      // 2. Fetch legacy successor config
      const legacyRes = await fetch('/api/user/legacy', { credentials: 'include' })
      const legacyData = await legacyRes.json()
      if (legacyData.success) {
        setSuccessor(legacyData.data.successor)
        setSuccessorStatus(legacyData.data.status)
        setInvitations(legacyData.data.invitations || [])
      }

      // 3. Fetch legacy claims
      const claimsRes = await fetch('/api/legacy-claims', { credentials: 'include' })
      const claimsData = await claimsRes.json()
      if (claimsData.success) {
        setInitiatedClaims(claimsData.data.initiatedClaims || [])
        setClaimsAgainstMe(claimsData.data.claimsAgainstMe || [])
        setPendingAdminReview(claimsData.data.pendingAdminReview || [])
      }
    } catch (err: any) {
      setError('Failed to load legacy contact data')
    } finally {
      setIsLoading(false)
    }
  }

  // Designate successor
  const handleDesignate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!designateEmail) return
    setError(null)
    setSuccess(null)
    setIsSubmittingDesignate(true)
    try {
      const res = await fetchWithCSRF('/api/user/legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: designateEmail }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to designate successor')

      setSuccess(`Legacy successor invitation sent to ${designateEmail}. They must accept it.`)
      setDesignateEmail('')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmittingDesignate(false)
    }
  }

  // Revoke successor
  const handleRevoke = async () => {
    if (!confirm('Are you sure you want to remove your designated legacy contact?')) return
    setError(null)
    setSuccess(null)
    try {
      const res = await fetchWithCSRF('/api/user/legacy', {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to revoke successor')

      setSuccess('Legacy contact configuration removed.')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Respond to invitation (Accept/Decline)
  const handleInvitationResponse = async (proposerId: string, accept: boolean) => {
    setError(null)
    setSuccess(null)
    try {
      const res = await fetchWithCSRF('/api/user/legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposerId, accept }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to respond to invitation')

      setSuccess(accept ? 'Invitation accepted! You are now their legacy contact.' : 'Invitation declined.')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Cancel a claim against me (I am alive!)
  const handleCancelClaimAgainstMe = async (claimId: string) => {
    if (!confirm('CONFIRM ACTION: Clicking this verifies that you are alive and active. This will instantly cancel the claim and suspend the claimant for fraud. Proceed?')) return
    setError(null)
    setSuccess(null)
    try {
      const res = await fetchWithCSRF('/api/legacy-claims/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to cancel claim')

      setSuccess('Alert cleared! The legacy claim has been rejected, and the fraudulent user has been suspended.')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Submit new legacy claim
  const handleInitiateClaim = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!claimEmail || !proofData) return
    setError(null)
    setSuccess(null)
    setIsSubmittingClaim(true)
    try {
      const res = await fetchWithCSRF('/api/legacy-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deceasedEmail: claimEmail,
          proofType,
          proofData,
          notes: claimNotes,
        }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to file claim')

      setSuccess('Legacy claim filed successfully. A 14-day cooling-off period has begun.')
      setIsClaimDialogOpen(false)
      setClaimEmail('')
      setProofData('')
      setClaimNotes('')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmittingClaim(false)
    }
  }

  // Admin approval
  const handleAdminApprove = async (claimId: string) => {
    if (!confirm('ADMIN CONTROL: This will bypass the remaining cooling-off period and execute the legacy transition. This marks the user as DECEASED and transfers space ownership. Continue?')) return
    setError(null)
    setSuccess(null)
    try {
      const res = await fetchWithCSRF('/api/legacy-claims/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to approve claim')

      setSuccess('Legacy transition approved and executed successfully.')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (isLoading) {
    return <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />
  }

  // Find any active cooling off claims against current user
  const activeClaimsAgainstMe = claimsAgainstMe.filter(c => c.status === 'COOLING_OFF')

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

      {/* 1. CRITICAL ALERTS: Claims against me */}
      {activeClaimsAgainstMe.map((claim) => (
        <Alert
          key={claim.id}
          severity="error"
          variant="filled"
          icon={<Warning fontSize="large" />}
          sx={{ mb: 4, py: 2 }}
          action={
            <Button
              variant="contained"
              color="warning"
              onClick={() => handleCancelClaimAgainstMe(claim.id)}
              sx={{ fontWeight: 'bold' }}
            >
              I am alive! Cancel claim
            </Button>
          }
        >
          <Typography variant="subtitle1" fontWeight={700}>
            ALERT: A digital legacy claim has been filed on your account
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            <strong>Claimant:</strong> {claim.claimant.displayName || claim.claimant.email}
          </Typography>
          <Typography variant="body2">
            <strong>Filed Date:</strong> {new Date(claim.initiatedAt).toLocaleDateString()}
          </Typography>
          <Typography variant="body2">
            If you do not cancel this claim, your account will be marked deceased and your stories will be transferred to your successor on{' '}
            <strong>{new Date(claim.expiresAt).toLocaleDateString()}</strong>.
          </Typography>
        </Alert>
      ))}

      {/* 2. Successor Configuration */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <SafetyCheck sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
            <Box>
              <Typography variant="h6">Digital Legacy Successor</Typography>
              <Typography variant="body2" color="text.secondary">
                Choose a family member to manage your stories, voice consents, and content if you pass away.
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {successor ? (
            <Box sx={{ p: 2, bgcolor: 'rgba(22, 51, 74, 0.04)', borderRadius: 2, mb: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Your Legacy Successor:
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {successor.displayName || 'No Display Name'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {successor.email}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 0.5 }}>
                    {successorStatus === 'ACCEPTED' ? (
                      <>
                        <CheckCircle color="success" fontSize="small" />
                        <Typography variant="caption" color="success.main" fontWeight={600}>
                          Active (Successor Accepted)
                        </Typography>
                      </>
                    ) : (
                      <>
                        <HourglassEmpty color="warning" fontSize="small" />
                        <Typography variant="caption" color="warning.main" fontWeight={600}>
                          Pending successor acceptance
                        </Typography>
                      </>
                    )}
                  </Box>
                </Box>
                <Button variant="outlined" color="error" size="small" onClick={handleRevoke}>
                  Revoke Successor
                </Button>
              </Stack>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleDesignate} sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 2 }}>
                You haven&apos;t designated a successor yet. Enter the email of a family member from one of your spaces.
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  label="Successor Email Address"
                  type="email"
                  size="small"
                  placeholder="e.g. sister@family.com"
                  value={designateEmail}
                  onChange={(e) => setDesignateEmail(e.target.value)}
                  disabled={isSubmittingDesignate}
                  required
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isSubmittingDesignate || !designateEmail}
                  startIcon={<PersonAdd />}
                >
                  Send Invite
                </Button>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* 3. Received Legacy Invitations */}
      {invitations.length > 0 && (
        <Card sx={{ mb: 4, border: '1px solid rgba(22, 51, 74, 0.12)' }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <SafetyCheck color="primary" /> Legacy Successor Requests
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              The following family members have asked you to be their digital legacy successor:
            </Typography>
            <List>
              {invitations.map((inv) => (
                <ListItem
                  key={inv.id}
                  sx={{
                    p: 2,
                    mb: 1,
                    bgcolor: '#fafafa',
                    borderRadius: 2,
                    border: '1px solid rgba(0, 0, 0, 0.04)',
                  }}
                  secondaryAction={
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        size="small"
                        color="success"
                        onClick={() => handleInvitationResponse(inv.id, true)}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        onClick={() => handleInvitationResponse(inv.id, false)}
                      >
                        Decline
                      </Button>
                    </Stack>
                  }
                >
                  <ListItemText
                    primary={inv.displayName || 'Family Member'}
                    secondary={inv.email}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* 4. Claims Panel */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Claims & Content Transitions</Typography>
            <Button
              variant="contained"
              size="small"
              onClick={() => setIsClaimDialogOpen(true)}
            >
              File Legacy Claim
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            If you are a designated successor for someone who has passed away, you can start the claim process here.
          </Typography>

          <Divider sx={{ mb: 3 }} />

          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
            Claims Filed by You:
          </Typography>

          {initiatedClaims.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              You haven&apos;t filed any claims yet.
            </Typography>
          ) : (
            <List>
              {initiatedClaims.map((claim) => (
                <ListItem
                  key={claim.id}
                  sx={{
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                    borderRadius: 2,
                    mb: 1.5,
                    p: 2,
                  }}
                >
                  <ListItemText
                    primary={`Claim on ${claim.deceasedUser.displayName || claim.deceasedUser.email}`}
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Status: <strong>{claim.status}</strong>
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Filed: {new Date(claim.initiatedAt).toLocaleDateString()}
                        </Typography>
                        {claim.status === 'COOLING_OFF' && (
                          <Typography variant="caption" color="warning.main" fontWeight={600} sx={{ display: 'block' }}>
                            Cooling off ends: {new Date(claim.expiresAt).toLocaleDateString()}
                          </Typography>
                        )}
                        {claim.resolutionNotes && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic', mt: 0.5 }}>
                            Note: {claim.resolutionNotes}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* 5. Admin Panel (Conditional) */}
      {isAdmin && pendingAdminReview.length > 0 && (
        <Card sx={{ border: '2px solid rgba(22, 51, 74, 0.2)', mb: 4 }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: '#16334a', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <VerifiedUser color="primary" /> Pending Legacy Claims (Admin Review)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              As a site administrator, you can review uploaded death certificates or obituaries to approve and finalize content transition.
            </Typography>

            <List>
              {pendingAdminReview.map((claim) => (
                <ListItem
                  key={claim.id}
                  sx={{
                    bgcolor: '#fafafa',
                    border: '1px solid rgba(0,0,0,0.06)',
                    borderRadius: 2,
                    p: 2.5,
                    mb: 2,
                  }}
                  secondaryAction={
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => handleAdminApprove(claim.id)}
                    >
                      Approve & Execute Takeover
                    </Button>
                  }
                >
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1" fontWeight={700}>
                        Claim on {claim.deceasedUser.email}
                      </Typography>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2">
                          <strong>Claimant:</strong> {claim.claimant.email}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Proof Link:</strong>{' '}
                          <a href={claim.proofData} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: '#16334a' }}>
                            View Proof Details
                          </a>
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          <strong>Notes:</strong> {claim.notes || 'None'}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Claims Dialog */}
      <Dialog open={isClaimDialogOpen} onClose={() => !isSubmittingClaim && setIsClaimDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>File Legacy Claim</DialogTitle>
        <Box component="form" onSubmit={handleInitiateClaim}>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              File a claim to start content custodianship. You must be pre-designated as their successor. The account owner will be notified and can cancel this if they are active.
            </Typography>

            <TextField
              fullWidth
              label="Account Owner Email"
              type="email"
              placeholder="e.g. father@family.com"
              value={claimEmail}
              onChange={(e) => setClaimEmail(e.target.value)}
              disabled={isSubmittingClaim}
              required
              sx={{ mb: 3 }}
            />

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Proof Type</InputLabel>
              <Select
                value={proofType}
                label="Proof Type"
                onChange={(e) => setProofType(e.target.value as any)}
                disabled={isSubmittingClaim}
              >
                <MenuItem value="OBITUARY_LINK">Obituary Web Link</MenuItem>
                <MenuItem value="DEATH_CERTIFICATE">Death Certificate Document Name / Ref</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label={proofType === 'OBITUARY_LINK' ? 'Obituary URL' : 'Certificate Details'}
              placeholder={proofType === 'OBITUARY_LINK' ? 'https://obituaries.com/family-member' : 'State Certificate #12345'}
              value={proofData}
              onChange={(e) => setProofData(e.target.value)}
              disabled={isSubmittingClaim}
              required
              sx={{ mb: 3 }}
            />

            <TextField
              fullWidth
              label="Additional Notes (optional)"
              multiline
              rows={3}
              value={claimNotes}
              onChange={(e) => setClaimNotes(e.target.value)}
              disabled={isSubmittingClaim}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsClaimDialogOpen(false)} disabled={isSubmittingClaim}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="error"
              disabled={isSubmittingClaim || !claimEmail || !proofData}
              startIcon={isSubmittingClaim ? <CircularProgress size={20} color="inherit" /> : null}
            >
              File Claim
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}
