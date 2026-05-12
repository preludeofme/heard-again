import Head from 'next/head'
import { useCallback, useEffect, useState } from 'react'
import { fetchWithCSRF } from '@/lib/api-client'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import { Download, PictureAsPdf, Hub } from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'

type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

interface ExportJobItem {
  id: string
  exportType: 'JSON' | 'PDF' | 'GEDCOM' | 'ZIP'
  status: ExportStatus
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
  outputAsset: {
    id: string
    originalName: string
    sizeBytes: number
    mimeType: string
    createdAt: string
  } | null
  downloadUrl: string | null
}

function statusColor(status: ExportStatus): 'default' | 'warning' | 'success' | 'error' {
  if (status === 'COMPLETED') return 'success'
  if (status === 'FAILED' || status === 'CANCELLED') return 'error'
  if (status === 'PENDING' || status === 'PROCESSING') return 'warning'
  return 'default'
}

export default function ExportPage() {
  const [jobs, setJobs] = useState<ExportJobItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRequestingJson, setIsRequestingJson] = useState(false)
  const [isRequestingPdf, setIsRequestingPdf] = useState(false)
  const [isRequestingGedcom, setIsRequestingGedcom] = useState(false)
  const [isRequestingZip, setIsRequestingZip] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadJobs = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/export/jobs', { credentials: 'include' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load export jobs')
      }

      setJobs(data.data.jobs || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load export jobs')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const requestJsonExport = async () => {
    setIsRequestingJson(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetchWithCSRF('/api/export/json', { method: 'POST', credentials: 'include' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to request JSON export')
      }

      setSuccess('JSON export created successfully.')
      await loadJobs()
    } catch (err: any) {
      setError(err.message || 'Failed to request JSON export')
    } finally {
      setIsRequestingJson(false)
    }
  }

  const requestPdfExport = async () => {
    setIsRequestingPdf(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetchWithCSRF('/api/export/pdf', { method: 'POST', credentials: 'include' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to request PDF export')
      }

      setSuccess('PDF export created successfully.')
      await loadJobs()
    } catch (err: any) {
      setError(err.message || 'Failed to request PDF export')
    } finally {
      setIsRequestingPdf(false)
    }
  }

  const requestGedcomExport = async () => {
    setIsRequestingGedcom(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetchWithCSRF('/api/export/gedcom', { method: 'POST', credentials: 'include' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to request GEDCOM export')
      }

      setSuccess('GEDCOM export created successfully.')
      await loadJobs()
    } catch (err: any) {
      setError(err.message || 'Failed to request GEDCOM export')
    } finally {
      setIsRequestingGedcom(false)
    }
  }

  const requestZipExport = async () => {
    setIsRequestingZip(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetchWithCSRF('/api/export/zip', { method: 'POST', credentials: 'include' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to request Full ZIP export')
      }

      setSuccess('Full ZIP export created successfully.')
      await loadJobs()
    } catch (err: any) {
      setError(err.message || 'Failed to request Full ZIP export')
    } finally {
      setIsRequestingZip(false)
    }
  }

  const downloadExport = async (jobId: string) => {
    setError(null)

    try {
      const response = await fetch(`/api/export/jobs/${jobId}/download`, { credentials: 'include' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Export is not ready for download')
      }

      if (data.data?.downloadUrl) {
        window.open(data.data.downloadUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to download export')
    }
  }

  return (
    <>
      <Head>
        <title>Export - Heard Again</title>
      </Head>
      <Layout>
        <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4', px: { xs: 3, md: 8 }, py: 6 }}>
          <Box sx={{ maxWidth: 900, mx: 'auto' }}>
            <Typography variant="h4" className="serif-font" sx={{ color: '#16334a', fontStyle: 'italic', mb: 1 }}>
              Export Tools
            </Typography>
            <Typography variant="body2" sx={{ color: '#546669', mb: 4 }}>
              Export your memories data and track export job progress.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" sx={{ mb: 3 }}>
                {success}
              </Alert>
            )}

            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 700, mb: 2 }}>
                  Export Options
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button
                    variant="contained"
                    startIcon={<Download />}
                    onClick={requestJsonExport}
                    disabled={isRequestingJson}
                  >
                    {isRequestingJson ? 'Creating JSON Export...' : 'Export JSON'}
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<PictureAsPdf />}
                    onClick={requestPdfExport}
                    disabled={isRequestingPdf}
                  >
                    {isRequestingPdf ? 'Creating PDF Export...' : 'Export PDF'}
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<Hub />}
                    onClick={requestGedcomExport}
                    disabled={isRequestingGedcom}
                  >
                    {isRequestingGedcom ? 'Creating GEDCOM Export...' : 'Export GEDCOM'}
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<Download />}
                    onClick={requestZipExport}
                    disabled={isRequestingZip}
                    color="secondary"
                  >
                    {isRequestingZip ? 'Creating Full Export...' : 'Full Export (ZIP)'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 700, mb: 2 }}>
                  Export Job Status
                </Typography>

                {isLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : jobs.length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#6f7c7f' }}>
                    No export jobs yet. Create your first export above.
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    {jobs.map((job, index) => (
                      <Box key={job.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                          <Box>
                            <Typography variant="subtitle2" sx={{ color: '#16334a', fontWeight: 700 }}>
                              {job.exportType} Export
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#6f7c7f' }}>
                              Requested: {new Date(job.createdAt).toLocaleString()}
                              {job.completedAt ? ` • Completed: ${new Date(job.completedAt).toLocaleString()}` : ''}
                            </Typography>
                            {job.errorMessage && (
                              <Typography variant="caption" sx={{ display: 'block', color: '#9c2a2a', mt: 0.5 }}>
                                {job.errorMessage}
                              </Typography>
                            )}
                          </Box>

                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip label={job.status} color={statusColor(job.status)} size="small" />
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => downloadExport(job.id)}
                              disabled={job.status !== 'COMPLETED' || !job.downloadUrl}
                            >
                              Download
                            </Button>
                          </Stack>
                        </Box>

                        {index < jobs.length - 1 && <Divider sx={{ mt: 2 }} />}
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Layout>
    </>
  )
}


export async function getServerSideProps() { return { props: {} } }
