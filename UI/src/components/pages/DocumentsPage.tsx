import { 
  Box, Typography, Card, CardContent, Button, Grid, Chip, 
  IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, 
  DialogActions, Tooltip, CircularProgress, useTheme, useMediaQuery,
  Paper
} from '@mui/material'
import { 
  CloudUpload as UploadIcon, 
  Delete as DeleteIcon, 
  Link as LinkIcon, 
  CheckCircle as LinkedIcon,
  Inventory2Outlined as BoxIcon,
  PhotoLibraryOutlined as PhotoIcon,
  DescriptionOutlined as DocumentIcon,
  HistoryEduOutlined as LetterIcon,
  FolderOpenOutlined as FolderIcon
} from '@mui/icons-material'
import { DocumentArtifact } from '@/types'
import { useState } from 'react'
import { EmptyState } from '@/components/feedback/UIStates'
import { FileUpload } from '@/components/upload/FileUpload'
import { DocumentViewer, DocumentThumbnail } from '@/components/viewers/DocumentViewer'
import { ProfileColors } from '@/components/profile/ProfileConstants'

interface DocumentsPageProps {
  documents: DocumentArtifact[]
  onUploadSuccess?: () => void
  onDelete?: (id: string) => Promise<void>
  onLink?: (assetId: string) => Promise<void>
  personId?: string
}

type FilterType = 'All' | 'Photo' | 'Letter' | 'Handwritten' | 'Document' | 'Other'

export function DocumentsPage({ documents, onUploadSuccess, onDelete, onLink, personId }: DocumentsPageProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('All')
  const [selectedDocument, setSelectedDocument] = useState<DocumentArtifact | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DocumentArtifact | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [linkingId, setLinkingId] = useState<string | null>(null)

  const filteredDocuments = documents.filter(doc => {
    if (selectedFilter === 'All') return true
    if (selectedFilter === 'Document') return doc.type === 'PDF'
    return doc.type === selectedFilter
  })

  const handleUploadSuccess = (result: any) => {
    onUploadSuccess?.()
  }

  const handleUploadError = (error: string) => {
    console.error('Upload failed:', error)
  }

  const handleDocumentClick = (document: any) => {
    setSelectedDocument(document)
    setViewerOpen(true)
  }

  const handleViewerClose = () => {
    setViewerOpen(false)
    setSelectedDocument(null)
  }

  const handleDeleteClick = (e: React.MouseEvent, doc: DocumentArtifact) => {
    e.stopPropagation()
    setDeleteTarget(doc)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !onDelete) return
    setIsDeleting(true)
    try {
      await onDelete(deleteTarget.id)
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteTarget(null)
  }

  const handleLinkClick = async (e: React.MouseEvent, doc: DocumentArtifact) => {
    e.stopPropagation()
    if (!onLink || linkingId) return
    setLinkingId(doc.id)
    try {
      await onLink(doc.id)
    } finally {
      setLinkingId(null)
    }
  }

  const filterOptions: Array<{ label: string; value: FilterType; icon: React.ReactNode }> = [
    { label: 'All', value: 'All', icon: <FolderIcon sx={{ fontSize: 18 }} /> },
    { label: 'Photos', value: 'Photo', icon: <PhotoIcon sx={{ fontSize: 18 }} /> },
    { label: 'Letters', value: 'Letter', icon: <LetterIcon sx={{ fontSize: 18 }} /> },
    { label: 'Handwritten', value: 'Handwritten', icon: <LetterIcon sx={{ fontSize: 18 }} /> },
    { label: 'Papers', value: 'Document', icon: <DocumentIcon sx={{ fontSize: 18 }} /> },
  ]

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: ProfileColors.surface, px: { xs: 2, md: 8 }, py: { xs: 4, md: 8 } }}>
      <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
        {/* Header Section */}
        <Box sx={{ mb: 6, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 3 }}>
          <Box>
            <Typography
              sx={{
                fontFamily: 'var(--font-manrope), sans-serif',
                fontSize: '0.85rem',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: ProfileColors.onSurfaceVariant,
                mb: 1
              }}
            >
              The Keepsake Drawer
            </Typography>
            <Typography 
              variant="h2" 
              className="serif-font" 
              sx={{ 
                color: ProfileColors.primary, 
                fontWeight: 700,
                fontSize: { xs: '2.5rem', md: '3.5rem' },
                lineHeight: 1,
                fontStyle: 'italic'
              }}
            >
              Heirlooms & Keepsakes
            </Typography>
            <Typography variant="body1" sx={{ color: ProfileColors.onSurfaceVariant, mt: 2, maxWidth: 500, fontFamily: 'var(--font-newsreader), serif', fontSize: '1.1rem' }}>
              Tuck away the letters, photos, and handwritten notes that tell your family's story.
            </Typography>
          </Box>
          
          <FileUpload
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
            accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.rtf"
            maxSize={50 * 1024 * 1024}
            personId={personId}
          >
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              sx={{
                backgroundColor: ProfileColors.primary,
                borderRadius: '999px',
                py: 1.5,
                px: 3,
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': { backgroundColor: ProfileColors.primaryContainer, color: ProfileColors.surfaceContainerLowest }
              }}
            >
              Add to the Box
            </Button>
          </FileUpload>
        </Box>

        {/* Tactile Filter Bar - 'Drawer Tabs' */}
        <Box 
          sx={{ 
            mb: 6, 
            display: 'flex', 
            justifyContent: 'center',
            overflowX: 'auto',
            pb: 1,
            '&::-webkit-scrollbar': { display: 'none' }
          }}
        >
          <Paper
            elevation={0}
            sx={{
              display: 'flex',
              p: 0.75,
              borderRadius: '999px',
              backgroundColor: ProfileColors.surfaceContainerLow,
              border: `1px solid ${ProfileColors.outlineVariant}20`
            }}
          >
            {filterOptions.map((opt) => (
              <Button
                key={opt.value}
                onClick={() => setSelectedFilter(opt.value)}
                startIcon={opt.icon}
                sx={{
                  px: 3,
                  py: 1,
                  borderRadius: '999px',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  color: selectedFilter === opt.value ? ProfileColors.primary : ProfileColors.onSurfaceVariant,
                  backgroundColor: selectedFilter === opt.value ? ProfileColors.surfaceContainerLowest : 'transparent',
                  boxShadow: selectedFilter === opt.value ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                  '&:hover': {
                    backgroundColor: selectedFilter === opt.value ? ProfileColors.surfaceContainerLowest : 'rgba(0,0,0,0.03)'
                  }
                }}
              >
                {opt.label}
              </Button>
            ))}
          </Paper>
        </Box>

        {/* Keepsake Grid - The 'Drawer' content */}
        <Grid container spacing={4}>
          {filteredDocuments.length === 0 && (
            <Grid size={12}>
              <Box sx={{ py: 12, textAlign: 'center', backgroundColor: ProfileColors.surfaceContainerLow, borderRadius: 8, border: `2px dashed ${ProfileColors.outlineVariant}30` }}>
                <BoxIcon sx={{ fontSize: 64, color: ProfileColors.outlineVariant, mb: 2, opacity: 0.5 }} />
                <Typography variant="h5" className="serif-font" sx={{ color: ProfileColors.primary, mb: 1 }}>
                  This drawer is empty
                </Typography>
                <Typography variant="body2" sx={{ color: ProfileColors.onSurfaceVariant, mb: 4 }}>
                  Start tucking away memories and heirlooms.
                </Typography>
                <FileUpload
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={handleUploadError}
                  accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.rtf"
                  maxSize={50 * 1024 * 1024}
                  personId={personId}
                >
                  <Button variant="outlined" sx={{ borderRadius: '999px', borderColor: ProfileColors.primary, color: ProfileColors.primary }}>
                    Tuck away your first keepsake
                  </Button>
                </FileUpload>
              </Box>
            </Grid>
          )}

          {filteredDocuments.map((doc) => (
            <Grid key={doc.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Card
                role="button"
                aria-label={`View keepsake: ${doc.title}`}
                onClick={() => handleDocumentClick(doc)}
                sx={{
                  backgroundColor: ProfileColors.surfaceContainerLowest,
                  borderRadius: 4,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'visible',
                  border: `1px solid ${ProfileColors.outlineVariant}10`,
                  '&:hover': {
                    transform: 'translateY(-8px) rotate(1deg)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
                    '& .doc-actions': { opacity: 1 },
                  },
                  // Stack effect for certain types
                  '&::after': doc.type === 'Letter' ? {
                    content: '""',
                    position: 'absolute',
                    top: 4,
                    left: 4,
                    right: -4,
                    bottom: -4,
                    backgroundColor: 'rgba(0,0,0,0.02)',
                    borderRadius: 4,
                    zIndex: -1,
                  } : {}
                }}
              >
                {/* Link status badge */}
                {personId && doc.linkedToPerson === true && (
                  <Tooltip title="Linked to this person">
                    <Box sx={{
                      position: 'absolute',
                      top: -10,
                      left: -10,
                      zIndex: 2,
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: '#fff',
                      boxShadow: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <LinkedIcon sx={{ fontSize: 18, color: '#2e7d32' }} />
                    </Box>
                  </Tooltip>
                )}
                
                {/* Actions overlay */}
                <Box 
                  className="doc-actions"
                  sx={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    zIndex: 2,
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    display: 'flex',
                    gap: 1
                  }}
                >
                  {personId && doc.linkedToPerson === false && (
                    <Tooltip title="Link to this person">
                      <IconButton
                        size="small"
                        onClick={(e) => handleLinkClick(e, doc)}
                        disabled={linkingId === doc.id}
                        sx={{
                          backgroundColor: 'rgba(255,255,255,0.9)',
                          '&:hover': { backgroundColor: '#e8f5e9', color: '#2e7d32' },
                          boxShadow: 1
                        }}
                      >
                        {linkingId === doc.id
                          ? <CircularProgress size={14} />
                          : <LinkIcon sx={{ fontSize: 14, color: ProfileColors.onSurfaceVariant }} />}
                      </IconButton>
                    </Tooltip>
                  )}
                  {onDelete && (
                    <IconButton
                      size="small"
                      aria-label={`Delete keepsake: ${doc.title}`}
                      onClick={(e) => handleDeleteClick(e, doc)}
                      sx={{
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        '&:hover': { backgroundColor: '#fdecea', color: '#d32f2f' },
                        boxShadow: 1
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>

                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ borderRadius: 3, overflow: 'hidden', mb: 2 }}>
                    <DocumentThumbnail
                      document={{
                        id: doc.id,
                        filename: doc.title,
                        originalName: doc.title,
                        mimeType: doc.mimeType || 'application/octet-stream',
                        publicUrl: `/api/assets/serve/${doc.id}`,
                        storagePath: doc.id
                      }}
                      onClick={() => handleDocumentClick(doc)}
                    />
                  </Box>
                  
                  <Box sx={{ px: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {doc.type === 'Photo' && <PhotoIcon sx={{ fontSize: 14, color: ProfileColors.onSurfaceVariant }} />}
                      {doc.type === 'Letter' && <LetterIcon sx={{ fontSize: 14, color: ProfileColors.onSurfaceVariant }} />}
                      {doc.type === 'PDF' && <DocumentIcon sx={{ fontSize: 14, color: ProfileColors.onSurfaceVariant }} />}
                      <Typography
                        variant="caption"
                        sx={{
                          color: ProfileColors.onSurfaceVariant,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}
                      >
                        {doc.type}
                      </Typography>
                    </Box>
                    
                    <Typography
                      sx={{
                        color: ProfileColors.primary,
                        fontWeight: 700,
                        fontFamily: 'var(--font-newsreader), serif',
                        fontSize: '1.1rem',
                        mb: 0.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {doc.title}
                    </Typography>
                    
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: ProfileColors.onSurfaceVariant, 
                        display: 'block',
                        fontFamily: 'var(--font-manrope), sans-serif',
                        opacity: 0.7
                      }}
                    >
                      Added {new Date(doc.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
      
      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={!!deleteTarget} 
        onClose={handleDeleteCancel} 
        maxWidth="xs" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle sx={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 700 }}>
          Remove this keepsake?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: ProfileColors.onSurfaceVariant }}>
            <strong>{deleteTarget?.title}</strong> will be permanently removed from the box. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleDeleteCancel} disabled={isDeleting} sx={{ color: ProfileColors.onSurfaceVariant, textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            disabled={isDeleting}
            variant="contained"
            color="error"
            sx={{ borderRadius: '999px', px: 3, textTransform: 'none', fontWeight: 600 }}
          >
            {isDeleting ? 'Removing…' : 'Remove Item'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Document Viewer Dialog */}
      <DocumentViewer
        open={viewerOpen}
        onClose={handleViewerClose}
        document={selectedDocument ? {
          id: selectedDocument.id,
          filename: selectedDocument.title,
          originalName: selectedDocument.title,
          mimeType: selectedDocument.mimeType || 'application/octet-stream',
          publicUrl: `/api/assets/serve/${selectedDocument.id}`,
          storagePath: selectedDocument.id
        } : {
          id: '',
          filename: '',
          originalName: '',
          mimeType: '',
          publicUrl: '',
          storagePath: ''
        }}
      />
    </Box>
  )
}
