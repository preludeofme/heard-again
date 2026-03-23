import Head from 'next/head'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import { UploadFile, LibraryMusic, DataObject } from '@mui/icons-material'
import { Layout } from '@/components/Layout'

type ImportTab = 'gedcom' | 'json' | 'bulk-audio'

type ImportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

interface ImportJobItem {
  id: string
  sourceType: string
  status: ImportStatus
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
  resultSummary: any
  sourceAsset: {
    id: string
    originalName: string
    mimeType: string
    sizeBytes: number
    createdAt: string
  } | null
}

function statusColor(status: ImportStatus): 'default' | 'warning' | 'success' | 'error' {
  if (status === 'COMPLETED') return 'success'
  if (status === 'FAILED' || status === 'CANCELLED') return 'error'
  if (status === 'PENDING' || status === 'PROCESSING') return 'warning'
  return 'default'
}

export default function ImportPage() {
  const [tab, setTab] = useState<ImportTab>('gedcom')
  const [jobs, setJobs] = useState<ImportJobItem[]>([])
  const [isLoadingJobs, setIsLoadingJobs] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const acceptedTypes = useMemo(() => {
    if (tab === 'gedcom') return '.ged,.gedcom,text/plain'
    if (tab === 'json') return '.json,application/json'
    return 'audio/*'
  }, [tab])

  const endpoint = useMemo(() => {
    if (tab === 'gedcom') return '/api/import/gedcom'
    if (tab === 'json') return '/api/import/json'
    return '/api/import/bulk-audio'
  }, [tab])

  const loadJobs = useCallback(async () => {
    setIsLoadingJobs(true)
    try {
      const response = await fetch('/api/import/jobs')
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load import jobs')
      }

      setJobs(data.data.jobs || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load import jobs')
    } finally {
      setIsLoadingJobs(false)
    }
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()

      if (tab === 'bulk-audio') {
        Array.from(files).forEach((file) => formData.append('file', file))
      } else {
        formData.append('file', files[0])
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Import failed')
      }

      setSuccess('Import job created successfully.')
      await loadJobs()
    } catch (err: any) {
      setError(err.message || 'Import failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Head>
        <title>Import Wizard - Heard Again</title>
      </Head>
      <Layout>
        <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4', px: { xs: 3, md: 8 }, py: 6 }}>
          <Box sx={{ maxWidth: 920, mx: 'auto' }}>
            <Typography variant="h4" className="serif-font" sx={{ color: '#16334a', fontStyle: 'italic', mb: 1 }}>
              Import Wizard
            </Typography>
            <Typography variant="body2" sx={{ color: '#546669', mb: 4 }}>
              Import genealogy files, JSON backups, or bulk audio assets.
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
                <Tabs
                  value={tab}
                  onChange={(_, value) => setTab(value as ImportTab)}
                  sx={{ mb: 2 }}
                >
                  <Tab value="gedcom" label="GEDCOM" icon={<UploadFile />} iconPosition="start" />
                  <Tab value="json" label="JSON Backup" icon={<DataObject />} iconPosition="start" />
                  <Tab value="bulk-audio" label="Bulk Audio" icon={<LibraryMusic />} iconPosition="start" />
                </Tabs>

                <Typography variant="body2" sx={{ color: '#546669', mb: 2 }}>
                  {tab === 'gedcom' && 'Upload a GEDCOM file to import genealogy records.'}
                  {tab === 'json' && 'Upload a Heard Again JSON backup file.'}
                  {tab === 'bulk-audio' && 'Upload one or more audio files to your workspace assets.'}
                </Typography>

                <Button
                  variant="contained"
                  component="label"
                  disabled={isSubmitting}
                  startIcon={<UploadFile />}
                >
                  {isSubmitting ? 'Uploading...' : tab === 'bulk-audio' ? 'Select Audio Files' : 'Select File'}
                  <input
                    hidden
                    type="file"
                    accept={acceptedTypes}
                    multiple={tab === 'bulk-audio'}
                    onChange={(event) => handleFiles(event.target.files)}
                  />
                </Button>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 700, mb: 2 }}>
                  Import Job Status
                </Typography>

                {isLoadingJobs ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : jobs.length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#6f7c7f' }}>
                    No import jobs yet. Upload a file above to start.
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    {jobs.map((job, index) => (
                      <Box key={job.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                          <Box>
                            <Typography variant="subtitle2" sx={{ color: '#16334a', fontWeight: 700 }}>
                              {job.sourceType} Import
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#6f7c7f' }}>
                              Requested: {new Date(job.createdAt).toLocaleString()}
                              {job.completedAt ? ` • Completed: ${new Date(job.completedAt).toLocaleString()}` : ''}
                            </Typography>
                            {job.sourceAsset?.originalName && (
                              <Typography variant="caption" sx={{ display: 'block', color: '#7f8a8d', mt: 0.5 }}>
                                Source: {job.sourceAsset.originalName}
                              </Typography>
                            )}
                            {job.errorMessage && (
                              <Typography variant="caption" sx={{ display: 'block', color: '#9c2a2a', mt: 0.5 }}>
                                {job.errorMessage}
                              </Typography>
                            )}
                          </Box>

                          <Chip label={job.status} color={statusColor(job.status)} size="small" />
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
