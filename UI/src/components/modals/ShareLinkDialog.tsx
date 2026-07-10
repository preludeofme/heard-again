import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, TextField, MenuItem, Alert, CircularProgress,
} from '@mui/material'
import { ContentCopy } from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { fetchWithCSRF } from '@/lib/api-client'
import type { ShareExpiryOption } from '@/lib/security/share-tokens'

const EXPIRY_LABELS: Record<ShareExpiryOption, string> = {
  never: 'Never expires',
  '24h': 'Expires in 24 hours',
  '7d': 'Expires in 7 days',
  '30d': 'Expires in 30 days',
}

interface ShareLinkDialogProps {
  open: boolean
  onClose: () => void
  title: string
  description: string
  /** Resource kind, used to build the API path */
  kind: 'story' | 'person'
  resourceId: string
  /** Current share state, if already known (avoids a flash of "not shared") */
  initialToken?: string | null
  initialExpiresAt?: string | null
  /** Where the link should point once generated, e.g. `/share/story/{id}` */
  buildShareUrl: (token: string) => string
}

export function ShareLinkDialog({
  open,
  onClose,
  title,
  description,
  kind,
  resourceId,
  initialToken,
  initialExpiresAt,
  buildShareUrl,
}: ShareLinkDialogProps) {
  const { enqueueSnackbar } = useSnackbar()
  const [token, setToken] = useState<string | null>(initialToken ?? null)
  const [expiresAt, setExpiresAt] = useState<string | null>(initialExpiresAt ?? null)
  const [expiryOption, setExpiryOption] = useState<ShareExpiryOption>('never')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiPath = `/api/${kind === 'story' ? 'stories' : 'people'}/${resourceId}/share`
  const shareUrl = token ? buildShareUrl(token) : null

  const handleGenerate = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetchWithCSRF(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ expiresIn: expiryOption }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create share link')
      }
      setToken(data.data.token)
      setExpiresAt(data.data.expiresAt)
      enqueueSnackbar('Share link created', { variant: 'success' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share link')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRevoke = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetchWithCSRF(apiPath, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to revoke share link')
      }
      setToken(null)
      setExpiresAt(null)
      enqueueSnackbar('Share link revoked', { variant: 'success' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke share link')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    enqueueSnackbar('Link copied to clipboard', { variant: 'success' })
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          {description}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {shareUrl ? (
          <Box>
            <TextField
              fullWidth
              value={shareUrl}
              InputProps={{ readOnly: true }}
              size="small"
              sx={{ mb: 1 }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {expiresAt
                ? `Expires ${new Date(expiresAt).toLocaleString()}`
                : 'This link never expires until you revoke it.'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Button variant="outlined" startIcon={<ContentCopy />} onClick={handleCopy}>
                Copy link
              </Button>
              <Button color="error" onClick={handleRevoke} disabled={isLoading}>
                {isLoading ? <CircularProgress size={20} /> : 'Revoke link'}
              </Button>
            </Box>
          </Box>
        ) : (
          <Box>
            <TextField
              select
              fullWidth
              size="small"
              label="Link expiration"
              value={expiryOption}
              onChange={(e) => setExpiryOption(e.target.value as ShareExpiryOption)}
              sx={{ mb: 2 }}
            >
              {(Object.keys(EXPIRY_LABELS) as ShareExpiryOption[]).map((option) => (
                <MenuItem key={option} value={option}>
                  {EXPIRY_LABELS[option]}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="contained" onClick={handleGenerate} disabled={isLoading} fullWidth>
              {isLoading ? <CircularProgress size={20} /> : 'Create share link'}
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
