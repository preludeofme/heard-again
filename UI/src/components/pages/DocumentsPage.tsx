import { Box, Typography, Card, CardContent, Button, Grid, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material'
import { CloudUpload as UploadIcon, FilterList as FilterIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { DocumentArtifact } from '@/types'
import { useState } from 'react'
import { EmptyState } from '@/components/feedback/UIStates'
import { FileUpload } from '@/components/upload/FileUpload'
import { DocumentViewer, DocumentThumbnail } from '@/components/viewers/DocumentViewer'

interface DocumentsPageProps {
  documents: DocumentArtifact[]
  onUploadSuccess?: () => void
  onDelete?: (id: string) => Promise<void>
  personId?: string
}

export function DocumentsPage({ documents, onUploadSuccess, onDelete, personId }: DocumentsPageProps) {
  const [selectedFilter, setSelectedFilter] = useState('All')
  const [selectedDocument, setSelectedDocument] = useState<any>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DocumentArtifact | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const filteredDocuments = documents.filter(doc => 
    selectedFilter === 'All' || doc.type === selectedFilter
  )

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

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4', px: { xs: 3, md: 8 }, py: 6 }}>
      <Box sx={{ backgroundColor: '#ffffff', borderRadius: 4, p: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h3" className="serif-font" sx={{ color: '#16334a' }}>
            Document Archive
          </Typography>
          <IconButton sx={{ color: '#546669' }}>
            <FilterIcon />
          </IconButton>
        </Box>

        {/* Filter Chips */}
        <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
          {(['All', 'PDF', 'Photo', 'Letter', 'Handwritten'] as const).map((filter) => (
            <Chip
              key={filter}
              label={filter}
              onClick={() => setSelectedFilter(filter)}
              sx={{
                backgroundColor: selectedFilter === filter ? '#16334a' : '#f6f3ee',
                color: selectedFilter === filter ? 'white' : '#546669',
                fontWeight: 600,
                '&:hover': {
                  backgroundColor: selectedFilter === filter ? '#2e4a62' : '#ebe8e3',
                }
              }}
            />
          ))}
        </Box>

        {/* Document Grid */}
        <Grid container spacing={3}>
          {filteredDocuments.length === 0 && (
            <Grid size={12}>
              <EmptyState type="documents" onAction={() => {}} />
            </Grid>
          )}

          {filteredDocuments.map((doc) => (
            <Grid key={doc.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Card
                sx={{
                  backgroundColor: '#f6f3ee',
                  border: 'none',
                  boxShadow: 'none',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  position: 'relative',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 2,
                    '& .doc-delete-btn': { opacity: 1 },
                  }
                }}
              >
                {onDelete && (
                  <IconButton
                    className="doc-delete-btn"
                    size="small"
                    onClick={(e) => handleDeleteClick(e, doc)}
                    sx={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      opacity: 0,
                      transition: 'opacity 0.15s',
                      backgroundColor: 'rgba(255,255,255,0.85)',
                      zIndex: 1,
                      '&:hover': { backgroundColor: '#fdecea', color: '#d32f2f' },
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
                <CardContent sx={{ p: 3 }}>
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
                  <Chip
                    label={doc.type}
                    size="small"
                    sx={{
                      backgroundColor: '#ffffff',
                      color: '#546669',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      mb: 1,
                      mt: 1
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#16334a',
                      fontWeight: 600,
                      mb: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {doc.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#546669' }}>
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </Typography>
                  <Button
                    size="small"
                    sx={{
                      color: '#16334a',
                      textTransform: 'none',
                      p: 0,
                      mt: 1,
                      '&:hover': { backgroundColor: 'transparent' }
                    }}
                  >
                    {doc.shareAction}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}

          {/* Upload Artifact Card — always rendered */}
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <FileUpload
              onUploadSuccess={handleUploadSuccess}
              onUploadError={handleUploadError}
              accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.rtf"
              maxSize={50 * 1024 * 1024}
              personId={personId}
            >
              <Card
                sx={{
                  backgroundColor: '#f6f3ee',
                  border: '2px dashed #d0e3e6',
                  boxShadow: 'none',
                  height: '100%',
                  minHeight: 200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: '#ebe8e3',
                    borderColor: '#16334a',
                  }
                }}
              >
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <UploadIcon sx={{ fontSize: 40, color: '#adcae6', mb: 2 }} />
                  <Typography variant="body1" sx={{ color: '#546669', fontWeight: 600 }}>
                    Upload Artifact
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#546669', mt: 1, display: 'block' }}>
                    Add photos, letters, or documents
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#adcae6', mt: 1, display: 'block' }}>
                    Drag & drop or click to browse
                  </Typography>
                </CardContent>
              </Card>
            </FileUpload>
          </Grid>
        </Grid>
      </Box>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onClose={handleDeleteCancel} maxWidth="xs" fullWidth>
        <DialogTitle>Delete document?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>{deleteTarget?.title}</strong> will be permanently removed. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleDeleteCancel} disabled={isDeleting} sx={{ color: '#546669' }}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            disabled={isDeleting}
            variant="contained"
            color="error"
            sx={{ minWidth: 90 }}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
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
          publicUrl: `/api/assets/serve/${selectedDocument.id}`, // Use the new serve endpoint
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
