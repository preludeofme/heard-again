import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { DocumentsPage } from '@/components/pages/DocumentsPage'
import { useDocumentsController } from '@/controllers/useDocumentsController'
import { Box, CircularProgress, Typography, Button } from '@mui/material'

export default function Documents() {
  const controller = useDocumentsController()

  return (
    <>
      <Head>
        <title>Documents - Heard Again</title>
        <meta name="description" content="Document Archive" />
      </Head>
      <Layout>
        {controller.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <CircularProgress />
          </Box>
        ) : controller.hasError ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 2 }}>
            <Typography color="error">{controller.errorMessage}</Typography>
            <Button variant="contained" onClick={controller.refreshDocuments}>Retry</Button>
          </Box>
        ) : (
          <DocumentsPage documents={controller.documents} />
        )}
      </Layout>
    </>
  )
}
