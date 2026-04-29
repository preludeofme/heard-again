import { Box, CircularProgress, Typography, Button } from '@mui/material'
import { DocumentsPage } from '@/components/pages/DocumentsPage'
import { useDocumentsController } from '@/controllers/useDocumentsController'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'

export function KeepsakesLens() {
  const { selectedFamilyMember } = useSelectedFamilyMember()
  const selectedSubjectId = selectedFamilyMember?.id
  const controller = useDocumentsController(selectedSubjectId)

  if (controller.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (controller.hasError) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '40vh', gap: 2 }}>
        <Typography color="error">{controller.errorMessage}</Typography>
        <Button variant="contained" onClick={controller.refreshDocuments}>Retry</Button>
      </Box>
    )
  }

  return (
    <DocumentsPage
      documents={controller.documents}
      onUploadSuccess={controller.refreshDocuments}
      onDelete={controller.deleteDocument}
      onLink={controller.linkDocument}
      personId={selectedSubjectId}
    />
  )
}
