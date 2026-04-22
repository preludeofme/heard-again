import { useState } from 'react'
import Image from 'next/image'
import { 
  Box, 
  Typography, 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  IconButton,
  Button,
  CircularProgress,
  Paper,
  Toolbar,
  AppBar
} from '@mui/material'
import { 
  Close as CloseIcon,
  Download as DownloadIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material'

interface DocumentViewerProps {
  open: boolean
  onClose: () => void
  document: {
    id: string
    filename: string
    originalName: string
    mimeType: string
    publicUrl?: string
    storagePath?: string
  }
}

export function DocumentViewer({ open, onClose, document }: DocumentViewerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const getViewerType = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType === 'application/pdf') return 'pdf'
    if (mimeType.includes('text') || mimeType === 'application/json') return 'text'
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document'
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'spreadsheet'
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation'
    return 'unsupported'
  }

  const viewerType = getViewerType(document.mimeType)

  const handleDownload = () => {
    const url = document.publicUrl || `/api/assets/${document.storagePath}`
    const link = window.document.createElement('a')
    link.href = url
    link.download = document.originalName
    window.document.body.appendChild(link)
    link.click()
    window.document.body.removeChild(link)
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5))
  }

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages))
  }

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1))
  }

  const renderViewer = () => {
    const url = document.publicUrl || `/api/assets/${document.storagePath}`

    switch (viewerType) {
      case 'image':
        return (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100%',
            overflow: 'auto',
            p: 2,
            position: 'relative'
          }}>
            <Image
              src={url}
              alt={document.originalName}
              fill
              style={{
                objectFit: 'contain',
                transform: `scale(${zoom})`,
                transition: 'transform 0.2s',
                cursor: zoom > 1 ? 'move' : 'default'
              }}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false)
                console.error('Failed to load image')
              }}
              unoptimized
            />
          </Box>
        )

      case 'pdf':
        return (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flexGrow: 1, position: 'relative' }}>
              <iframe
                src={`${url}#view=FitV&zoom=${zoom * 100}`}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none'
                }}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false)
                  console.error('Failed to load PDF')
                }}
              />
            </Box>
          </Box>
        )

      case 'text':
        return (
          <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
            <iframe
              src={url}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                fontFamily: 'monospace',
                fontSize: '14px'
              }}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false)
                console.error('Failed to load text file')
              }}
            />
          </Box>
        )

      case 'document':
        // .doc / .docx: render mammoth-converted HTML in a sandboxed iframe
        return (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flexGrow: 1, position: 'relative' }}>
              <iframe
                src={`/api/assets/${document.id}/preview`}
                sandbox="allow-same-origin"
                style={{ width: '100%', height: '100%', border: 'none' }}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false)
                  console.error('Failed to load document preview')
                }}
              />
            </Box>
          </Box>
        )

      case 'spreadsheet':
      case 'presentation':
        return (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  {viewerType === 'spreadsheet' ? 'Spreadsheet' : 'Presentation'} Preview
                </Typography>
                <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                  This file type cannot be previewed directly. Please download to view.
                </Typography>
                <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleDownload}>
                  Download {document.originalName}
                </Button>
              </Box>
            </Box>
          </Box>
        )

      default:
        return (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100%',
            p: 4
          }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Unsupported File Type
              </Typography>
              <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                Cannot preview files of type: {document.mimeType}
              </Typography>
              <Button 
                variant="contained" 
                startIcon={<DownloadIcon />}
                onClick={handleDownload}
              >
                Download {document.originalName}
              </Button>
            </Box>
          </Box>
        )
    }
  }

  const renderToolbar = () => {
    if (viewerType === 'image') {
      return (
        <Toolbar>
          <IconButton onClick={handleZoomOut} disabled={zoom <= 0.5}>
            <ZoomOutIcon />
          </IconButton>
          <Typography sx={{ mx: 2, minWidth: '60px', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <IconButton onClick={handleZoomIn} disabled={zoom >= 3}>
            <ZoomInIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={handleDownload}>
            <DownloadIcon />
          </IconButton>
        </Toolbar>
      )
    }

    if (viewerType === 'pdf') {
      return (
        <Toolbar>
          <IconButton onClick={handlePrevPage} disabled={currentPage <= 1}>
            <ArrowBackIcon />
          </IconButton>
          <Typography sx={{ mx: 2, minWidth: '80px', textAlign: 'center' }}>
            Page {currentPage} of {totalPages}
          </Typography>
          <IconButton onClick={handleNextPage} disabled={currentPage >= totalPages}>
            <ArrowForwardIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={handleZoomOut} disabled={zoom <= 0.5}>
            <ZoomOutIcon />
          </IconButton>
          <Typography sx={{ mx: 2, minWidth: '60px', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <IconButton onClick={handleZoomIn} disabled={zoom >= 3}>
            <ZoomInIcon />
          </IconButton>
          <IconButton onClick={handleDownload}>
            <DownloadIcon />
          </IconButton>
        </Toolbar>
      )
    }

    return (
      <Toolbar>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton onClick={handleDownload}>
          <DownloadIcon />
        </IconButton>
      </Toolbar>
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Typography variant="h6" component="span" noWrap>
          {document.originalName}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {renderToolbar()}

      <DialogContent sx={{ 
        p: 0, 
        height: 'calc(90vh - 120px)',
        position: 'relative'
      }}>
        {isLoading && (
          <Box sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            zIndex: 1
          }}>
            <CircularProgress />
          </Box>
        )}
        
        {renderViewer()}
      </DialogContent>
    </Dialog>
  )
}

// Mini thumbnail viewer for grid view
export function DocumentThumbnail({ 
  document, 
  onClick 
}: { 
  document: DocumentViewerProps['document']
  onClick: () => void 
}) {
  const [imageError, setImageError] = useState(false)

  const getThumbnailContent = () => {
    const url = document.publicUrl || `/api/assets/${document.storagePath}`
    const viewerType = getViewerType(document.mimeType)

    if (viewerType === 'image' && !imageError) {
      return (
        <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
          <Image
            src={url}
            alt={document.originalName}
            fill
            style={{
              objectFit: 'cover',
              borderRadius: '8px'
            }}
            onError={() => setImageError(true)}
            unoptimized
          />
        </Box>
      )
    }

    // Fallback icons for different file types
    const getFileIcon = () => {
      if (document.mimeType.startsWith('image/')) return '🖼️'
      if (document.mimeType === 'application/pdf') return '📄'
      if (document.mimeType.includes('word') || document.mimeType.includes('document')) return '📝'
      if (document.mimeType.includes('sheet') || document.mimeType.includes('excel')) return '📊'
      if (document.mimeType.includes('presentation') || document.mimeType.includes('powerpoint')) return '📽️'
      if (document.mimeType.includes('text')) return '📄'
      return '📁'
    }

    return (
      <Box sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        border: '1px solid #e0e0e0'
      }}>
        <Typography variant="h3" sx={{ mb: 1 }}>
          {getFileIcon()}
        </Typography>
        <Typography variant="caption" sx={{ textAlign: 'center', px: 1 }}>
          {document.originalName.length > 20 
            ? document.originalName.substring(0, 20) + '...'
            : document.originalName
          }
        </Typography>
      </Box>
    )
  }

  const getViewerType = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType === 'application/pdf') return 'pdf'
    if (mimeType.includes('text') || mimeType === 'application/json') return 'text'
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document'
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'spreadsheet'
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation'
    return 'unsupported'
  }

  return (
    <Box
      onClick={onClick}
      sx={{
        width: '100%',
        height: '200px',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 3
        }
      }}
    >
      {getThumbnailContent()}
    </Box>
  )
}
