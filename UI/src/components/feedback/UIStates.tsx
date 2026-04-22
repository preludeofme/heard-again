import { Box, Typography, CircularProgress, Button } from '@mui/material'
import { 
  CloudUploadOutlined as UploadIcon, 
  MicNoneOutlined as MicIcon, 
  EditOutlined as EditIcon, 
  ErrorOutlineOutlined as ErrorIcon 
} from '@mui/icons-material'

interface EmptyStateProps {
  type: 'documents' | 'samples' | 'stories' | 'recordings'
  onAction?: () => void
}

export function EmptyState({ type, onAction }: EmptyStateProps) {
  const getEmptyStateContent = () => {
    switch (type) {
      case 'documents':
        return {
          icon: <UploadIcon sx={{ fontSize: 64, color: '#adcae6', mb: 2 }} />,
          title: 'No documents yet',
          description: 'Start building the archive by uploading photos, letters, and other precious memories.',
          actionText: 'Upload First Document',
        }
      case 'samples':
        return {
          icon: <MicIcon sx={{ fontSize: 64, color: '#adcae6', mb: 2 }} />,
          title: 'No voice samples recorded',
          description: 'Record voice samples to help create a faithful AI clone that can speak like them.',
          actionText: 'Record First Sample',
        }
      case 'stories':
        return {
          icon: <EditIcon sx={{ fontSize: 64, color: '#adcae6', mb: 2 }} />,
          title: 'No stories shared yet',
          description: 'Be the first to share a memory, story, or message that celebrates their life.',
          actionText: 'Share First Story',
        }
      case 'recordings':
        return {
          icon: <MicIcon sx={{ fontSize: 64, color: '#adcae6', mb: 2 }} />,
          title: 'No recordings in progress',
          description: 'Start a new recording to capture memories that will last forever.',
          actionText: 'Start Recording',
        }
      default:
        return {
          icon: <Box sx={{ fontSize: 64, color: '#adcae6', mb: 2 }}>📂</Box>,
          title: 'Nothing here yet',
          description: 'Check back later or add something new.',
          actionText: 'Add Content',
        }
    }
  }

  const content = getEmptyStateContent()

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 4,
        textAlign: 'center',
        minHeight: 400,
      }}
    >
      {content.icon}
      <Typography variant="h5" className="serif-font" sx={{ color: '#16334a', mb: 2 }}>
        {content.title}
      </Typography>
      <Typography variant="body1" sx={{ color: '#546669', mb: 4, maxWidth: 400 }}>
        {content.description}
      </Typography>
      {onAction && (
        <Button
          variant="contained"
          onClick={onAction}
          sx={{
            background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
            px: 4,
            py: 1.5,
          }}
        >
          {content.actionText}
        </Button>
      )}
    </Box>
  )
}

interface ErrorStateProps {
  type: 'recording' | 'upload' | 'post' | 'network'
  onRetry?: () => void
  onDismiss?: () => void
}

export function ErrorState({ type, onRetry, onDismiss }: ErrorStateProps) {
  const getErrorContent = () => {
    switch (type) {
      case 'recording':
        return {
          title: 'Recording failed',
          description: 'We couldn\'t access your microphone. Please check your permissions and try again.',
          actionText: 'Try Again',
        }
      case 'upload':
        return {
          title: 'Upload failed',
          description: 'The file couldn\'t be uploaded. Please check your connection and try again.',
          actionText: 'Retry Upload',
        }
      case 'post':
        return {
          title: 'Couldn\'t post memory',
          description: 'Something went wrong while sharing your story. Please try again in a moment.',
          actionText: 'Try Again',
        }
      case 'network':
        return {
          title: 'Connection error',
          description: 'We\'re having trouble connecting. Please check your internet connection.',
          actionText: 'Retry',
        }
      default:
        return {
          title: 'Something went wrong',
          description: 'An unexpected error occurred. Please try again.',
          actionText: 'Try Again',
        }
    }
  }

  const content = getErrorContent()

  return (
    <Box
      sx={{
        backgroundColor: '#fef6f6',
        border: '1px solid #fecaca',
        borderRadius: 3,
        p: 3,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 2,
      }}
    >
      <ErrorIcon sx={{ color: '#dc2626', fontSize: 24, mt: 0.5 }} />
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="h6" sx={{ color: '#991b1b', mb: 1 }}>
          {content.title}
        </Typography>
        <Typography variant="body2" sx={{ color: '#7f1d1d', mb: 2 }}>
          {content.description}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {onRetry && (
            <Button
              variant="contained"
              size="small"
              onClick={onRetry}
              sx={{
                backgroundColor: '#dc2626',
                '&:hover': { backgroundColor: '#b91c1c' },
              }}
            >
              {content.actionText}
            </Button>
          )}
          {onDismiss && (
            <Button variant="text" size="small" onClick={onDismiss} sx={{ color: '#7f1d1d' }}>
              Dismiss
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  )
}

interface LoadingStateProps {
  type: 'voice-cloning' | 'uploading' | 'processing' | 'sending'
  progress?: number
}

export function LoadingState({ type, progress }: LoadingStateProps) {
  const getLoadingContent = () => {
    switch (type) {
      case 'voice-cloning':
        return {
          title: 'Creating voice clone',
          description: 'Analyzing voice patterns and building the AI model. This may take a few minutes.',
        }
      case 'uploading':
        return {
          title: 'Uploading file',
          description: 'Your file is being securely uploaded to the archive.',
        }
      case 'processing':
        return {
          title: 'Processing',
          description: 'We\'re preparing your content. This will just take a moment.',
        }
      case 'sending':
        return {
          title: 'Sending message',
          description: 'Delivering your message to the conversation.',
        }
      default:
        return {
          title: 'Loading',
          description: 'Please wait...',
        }
    }
  }

  const content = getLoadingContent()

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 6,
        px: 4,
        textAlign: 'center',
      }}
    >
      <CircularProgress
        variant={progress !== undefined ? 'determinate' : 'indeterminate'}
        value={progress}
        size={48}
        thickness={4}
        sx={{
          color: '#16334a',
          mb: 3,
        }}
      />
      <Typography variant="h6" sx={{ color: '#16334a', mb: 1 }}>
        {content.title}
      </Typography>
      <Typography variant="body2" sx={{ color: '#546669' }}>
        {content.description}
      </Typography>
      {progress !== undefined && (
        <Typography variant="caption" sx={{ color: '#546669', mt: 1 }}>
          {progress}% complete
        </Typography>
      )}
    </Box>
  )
}
