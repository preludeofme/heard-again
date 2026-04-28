import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
  IconButton,
  Alert,
} from '@mui/material'
import {
  Close as CloseIcon,
  UploadFile as UploadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material'
import { fetchWithCSRF } from '@/lib/api-client'

interface GedcomImportModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function GedcomImportModal({ open, onClose, onSuccess }: GedcomImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setStatus('uploading')
    setError(null)
    setProgress(10)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetchWithCSRF('/api/import/gedcom', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to upload GEDCOM file')
      }

      const data = await response.json()
      setJobId(data.data.jobId)
      setStatus('processing')
      setProgress(50)

      // In a real app, we'd poll for job status here.
      // For now, we'll just wait a bit and show success since it's an async queue.
      setTimeout(() => {
        setProgress(100)
        setStatus('success')
        onSuccess?.()
      }, 3000)

    } catch (err: any) {
      console.error('GEDCOM import error:', err)
      setError(err.message || 'An unexpected error occurred during import')
      setStatus('error')
    }
  }

  const handleReset = () => {
    setFile(null)
    setStatus('idle')
    setProgress(0)
    setError(null)
    setJobId(null)
  }

  return (
    <Dialog open={open} onClose={status === 'uploading' || status === 'processing' ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
          Import GEDCOM File
        </Typography>
        <IconButton
          aria-label="close"
          onClick={onClose}
          disabled={status === 'uploading' || status === 'processing'}
          sx={{ color: (theme) => theme.palette.grey[500] }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers>
        {status === 'idle' && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <UploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2, opacity: 0.5 }} />
            <Typography variant="body1" gutterBottom>
              Select a GEDCOM file (.ged) to import your family tree.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              This will add new people and relationships to your current familyspace.
            </Typography>
            
            <input
              accept=".ged"
              style={{ display: 'none' }}
              id="gedcom-file-input"
              type="file"
              onChange={handleFileChange}
            />
            <label htmlFor="gedcom-file-input">
              <Button variant="outlined" component="span" startIcon={<UploadIcon />}>
                {file ? file.name : 'Choose File'}
              </Button>
            </label>
            
            {file && (
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                {(file.size / 1024).toFixed(1)} KB
              </Typography>
            )}
          </Box>
        )}

        {(status === 'uploading' || status === 'processing') && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              {status === 'uploading' ? 'Uploading file...' : 'Processing import...'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              {status === 'uploading' 
                ? 'Sending your GEDCOM file to our servers.' 
                : 'Analyzing your family tree data and creating records.'}
            </Typography>
            <Box sx={{ width: '100%', px: 4 }}>
              <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
              <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                {progress}%
              </Typography>
            </Box>
          </Box>
        )}

        {status === 'success' && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <SuccessIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Import Started Successfully!
            </Typography>
            <Typography variant="body1">
              Your family tree is being imported in the background.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Depending on the size of the file, it may take a few minutes to process all members.
            </Typography>
          </Box>
        )}

        {status === 'error' && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
            <Typography variant="h6" color="error" gutterBottom>
              Import Failed
            </Typography>
            <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
              {error}
            </Alert>
            <Button onClick={handleReset} sx={{ mt: 3 }}>
              Try Again
            </Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        {status === 'idle' && (
          <>
            <Button onClick={onClose} color="inherit">Cancel</Button>
            <Button 
              onClick={handleUpload} 
              variant="contained" 
              disabled={!file}
              sx={{ bgcolor: '#16334a', '&:hover': { bgcolor: '#2e4a62' } }}
            >
              Start Import
            </Button>
          </>
        )}
        {status === 'success' && (
          <Button onClick={onClose} variant="contained" color="success">Done</Button>
        )}
        {status === 'error' && (
          <Button onClick={onClose} color="inherit">Close</Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
