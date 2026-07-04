
import { Box, Typography, Button, CircularProgress, Alert } from '@mui/material'
import { AutoFixHigh as MagicIcon, Refresh as RefreshIcon, Warning as StaleIcon } from '@mui/icons-material'

export type NarrationBannerMode = 'opt-in' | 'stale' | 'failed'

interface NarrationPreparationBannerProps {
  mode: NarrationBannerMode
  subjectName?: string
  isWorking: boolean
  error?: string | null
  onPrepare: () => void
  onKeep?: () => void
  onDiscardError?: () => void
}

export function NarrationPreparationBanner({
  mode,
  subjectName,
  isWorking,
  error,
  onPrepare,
  onKeep,
  onDiscardError,
}: NarrationPreparationBannerProps) {
  const subject = subjectName?.trim() || 'the subject'

  const copy = {
    'opt-in': {
      icon: <MagicIcon sx={{ color: '#16334a' }} />,
      title: `Have ${subject} tell this story in their own voice`,
      body: `We can polish the text into first-person (e.g., "I remember…") so the narration sounds like ${subject} telling it. You'll review the rewrite before anything is narrated. Your original story stays untouched.`,
      cta: 'Prepare narration',
    },
    stale: {
      icon: <StaleIcon sx={{ color: '#e65100' }} />,
      title: 'Narration is out of date',
      body: `The story was edited after the narration was prepared. Regenerate the first-person rewrite so ${subject}'s reading reflects the current text.`,
      cta: 'Regenerate narration',
    },
    failed: {
      icon: <StaleIcon sx={{ color: '#c62828' }} />,
      title: 'Narration failed',
      body: 'Something went wrong. Try again — your story is safe.',
      cta: 'Try again',
    },
  }[mode]

  const bg = mode === 'opt-in' ? '#eef3f4' : mode === 'stale' ? '#fff3e0' : '#fce4ec'
  const border = mode === 'opt-in' ? '#d0e3e6' : mode === 'stale' ? '#ffcc80' : '#f8bbd0'

  return (
    <Box
      sx={{
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderRadius: 3,
        p: 3,
        mb: 4,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'flex-start', md: 'center' },
        gap: 2,
      }}
    >
      <Box sx={{ fontSize: 28, display: 'flex' }}>{copy.icon}</Box>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#16334a', mb: 0.5 }}>
          {copy.title}
        </Typography>
        <Typography variant="body2" sx={{ color: '#546669', lineHeight: 1.5 }}>
          {copy.body}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }} onClose={onDiscardError}>
            {error}
          </Alert>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', md: 'auto' }, justifyContent: 'flex-end' }}>
        {mode === 'stale' && onKeep && (
          <Button
            onClick={onKeep}
            variant="outlined"
            disabled={isWorking}
            sx={{
              borderColor: '#16334a',
              color: '#16334a',
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              '&:hover': { backgroundColor: 'rgba(22, 51, 74, 0.04)', borderColor: '#16334a' },
            }}
          >
            Keep existing
          </Button>
        )}
        <Button
          onClick={onPrepare}
          variant="contained"
          startIcon={
            isWorking ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <RefreshIcon />
          }
          disabled={isWorking}
          sx={{
            backgroundColor: '#16334a',
            color: 'white',
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            '&:hover': { backgroundColor: '#2e4a62' },
            '&.Mui-disabled': { backgroundColor: '#ccc', color: '#fff' },
          }}
        >
          {isWorking ? 'Preparing…' : copy.cta}
        </Button>
      </Box>
    </Box>
  )
}
