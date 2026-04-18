import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
} from '@mui/material'
import { CheckCircle, Close } from '@mui/icons-material'

interface SuccessModalProps {
  open: boolean
  onClose: () => void
  title?: string
  message?: string
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  open,
  onClose,
  title = 'Success!',
  message = 'Operation completed successfully.',
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="success-dialog-title"
      PaperProps={{
        sx: {
          borderRadius: 4,
          p: 1,
        },
      }}
    >
      <DialogTitle id="success-dialog-title" sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle sx={{ color: '#4caf50', fontSize: 28 }} />
            <Typography variant="h5" sx={{ color: '#16334a', fontWeight: 600 }}>
              {title}
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Close dialog" sx={{ color: '#546669' }}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.6 }}>
          {message}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            backgroundColor: '#16334a',
            textTransform: 'none',
            borderRadius: 2,
            px: 4,
            '&:hover': { backgroundColor: '#2e4a62' },
          }}
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
  )
}
