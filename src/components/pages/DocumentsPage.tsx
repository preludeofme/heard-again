import { Box, Typography, Card, CardContent, Button, Grid, Chip, IconButton } from '@mui/material'
import { CloudUpload as UploadIcon, FilterList as FilterIcon } from '@mui/icons-material'
import { DocumentArtifact } from '@/types'
import { useState } from 'react'
import { EmptyState } from '@/components/feedback/UIStates'

interface DocumentsPageProps {
  documents: DocumentArtifact[]
}

export function DocumentsPage({ documents }: DocumentsPageProps) {
  const [selectedFilter, setSelectedFilter] = useState('All')

  const filteredDocuments = documents.filter(doc => 
    selectedFilter === 'All' || doc.type === selectedFilter
  )

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
                  {/* Thumbnail */}
                  <Box
                    sx={{
                      aspectRatio: '3/4',
                      backgroundColor: '#ebe8e3',
                      borderRadius: 2,
                      mb: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundImage: doc.thumbnailUrl ? `url(${doc.thumbnailUrl})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {!doc.thumbnailUrl && (
                      <Typography variant="h6" sx={{ color: '#adcae6', fontWeight: 'bold' }}>
                        {doc.type.toUpperCase()}
                      </Typography>
                    )}
                  </Box>
                  
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
                <Card
                  sx={{
                    backgroundColor: '#f6f3ee',
                    border: '2px dashed #d0e3e6',
                    boxShadow: 'none',
                    cursor: 'pointer',
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
                  </CardContent>
                </Card>
              </Grid>
            </>
          )}
        </Grid>
      </Box>
    </Box>
  )
}
