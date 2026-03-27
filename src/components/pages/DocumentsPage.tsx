import { Box, Typography, Card, CardContent, Button, Grid, Chip, IconButton } from '@mui/material'
import { CloudUpload as UploadIcon, FilterList as FilterIcon } from '@mui/icons-material'
import { DocumentArtifact } from '@/types'
import { useState } from 'react'
import { EmptyState } from '@/components/feedback/UIStates'
import { FileUpload } from '@/components/upload/FileUpload'
import { DocumentViewer, DocumentThumbnail } from '@/components/viewers/DocumentViewer'

// Helper function to convert DocumentArtifact type back to mimeType
function getMimeTypeFromType(type: DocumentArtifact['type']): string {
  switch (type) {
    case 'PDF': return 'application/pdf'
    case 'Photo': return 'image/jpeg' // Default image type
    case 'Letter': 
    case 'Handwritten': 
    default: return 'application/octet-stream'
  }
}

interface DocumentsPageProps {
  documents: DocumentArtifact[]
}

export function DocumentsPage({ documents }: DocumentsPageProps) {
  const [selectedFilter, setSelectedFilter] = useState('All')
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([])
  const [selectedDocument, setSelectedDocument] = useState<any>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  const filteredDocuments = documents.filter(doc => 
    selectedFilter === 'All' || doc.type === selectedFilter
  )

  const handleUploadSuccess = (result: any) => {
    console.log('Upload successful:', result)
    // You could add the uploaded file to the state or refresh the documents list
    setUploadedFiles(prev => [...prev, result])
    
    // Show success message
    if (result.optimization) {
      console.log(`File optimized: ${result.optimization.sizeSavedPercentage} reduction`)
    }
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
          {['All', 'PDFs', 'Handwritten', 'Photos', 'Letters'].map((filter) => (
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
          {filteredDocuments.length === 0 ? (
            <Grid size={12}>
              <EmptyState type="documents" onAction={() => {}} />
            </Grid>
          ) : (
            <>
              {filteredDocuments.map((doc) => (
            <Grid key={doc.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Card
                sx={{
                  backgroundColor: '#f6f3ee',
                  border: 'none',
                  boxShadow: 'none',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 2,
                  }
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  {/* Interactive Thumbnail */}
                  <DocumentThumbnail
                    document={{
                      id: doc.id,
                      filename: doc.title, // Use title as filename since DocumentArtifact doesn't have filename
                      originalName: doc.title,
                      mimeType: getMimeTypeFromType(doc.type), // Convert type back to mimeType
                      publicUrl: `/api/assets/serve/${doc.id}`, // Use the new serve endpoint
                      storagePath: doc.id // Use id as storage path
                    }}
                    onClick={() => handleDocumentClick(doc)}
                  />
                  
                  {/* Type Pill */}
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
                  
                  {/* Title */}
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
                  
                  {/* Date */}
                  <Typography variant="caption" sx={{ color: '#546669' }}>
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </Typography>
                  
                  {/* Share Action */}
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
              
              {/* Upload Artifact Card */}
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <FileUpload
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={handleUploadError}
                  accept="image/*,application/pdf,.doc,.docx,.txt,.rtf"
                  maxSize={50 * 1024 * 1024} // 50MB
                >
                  <Card
                    sx={{
                      backgroundColor: '#f6f3ee',
                      border: '2px dashed #d0e3e6',
                      boxShadow: 'none',
                      height: '100%',
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
            </>
          )}
        </Grid>
      </Box>
      
      {/* Document Viewer Dialog */}
      <DocumentViewer
        open={viewerOpen}
        onClose={handleViewerClose}
        document={selectedDocument ? {
          id: selectedDocument.id,
          filename: selectedDocument.title,
          originalName: selectedDocument.title,
          mimeType: getMimeTypeFromType(selectedDocument.type),
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
