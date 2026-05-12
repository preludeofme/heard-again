
import { useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Button,
  Paper,
  LinearProgress,
  Alert,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  Image as ImageIcon,
  AudioFile as AudioIcon,
  VideoFile as VideoIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
} from '@mui/icons-material'
import { fetchWithCSRFAndFormData } from '@/lib/api-client'

interface FileUpload {
  file: File
  id: string
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
  assetId?: string
}

interface AssetUploadProps {
  onUploadComplete?: (assets: { id: string; filename: string; url: string }[]) => void
  allowedTypes?: string[]
  maxFileSize?: number // in MB
  maxFiles?: number
  multiple?: boolean
}

export function AssetUpload({
  onUploadComplete,
  allowedTypes = ['image/*', 'audio/*', 'video/*', 'application/pdf'],
  maxFileSize = 50,
  maxFiles = 10,
  multiple = true,
}: AssetUploadProps) {
  const [files, setFiles] = useState<FileUpload[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const generateId = () => Math.random().toString(36).substring(2, 9)

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize * 1024 * 1024) {
      return `File size exceeds ${maxFileSize}MB limit`
    }

    const isAllowed = allowedTypes.some((type) => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.replace('/*', ''))
      }
      return file.type === type
    })

    if (!isAllowed) {
      return 'File type not allowed'
    }

    return null
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon color="primary" />
    if (fileType.startsWith('audio/')) return <AudioIcon color="primary" />
    if (fileType.startsWith('video/')) return <VideoIcon color="primary" />
    return <FileIcon color="primary" />
  }

  const handleFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return

      setGlobalError(null)

      if (files.length + newFiles.length > maxFiles) {
        setGlobalError(`Maximum ${maxFiles} files allowed`)
        return
      }

      const newUploads: FileUpload[] = []

      Array.from(newFiles).forEach((file) => {
        const error = validateFile(file)
        newUploads.push({
          file,
          id: generateId(),
          progress: 0,
          status: error ? 'error' : 'pending',
          error: error || undefined,
        })
      })

      setFiles((prev) => [...prev, ...newUploads])

      // Auto-start upload for valid files
      newUploads.forEach((upload) => {
        if (!upload.error) {
          uploadFile(upload)
        }
      })
    },
    [files.length, maxFiles, maxFileSize, allowedTypes]
  )

  const uploadFile = async (upload: FileUpload) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === upload.id ? { ...f, status: 'uploading' } : f))
    )

    const formData = new FormData()
    formData.append('file', upload.file)

    try {
      const response = await fetchWithCSRFAndFormData('/api/assets/upload', formData)

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === upload.id && f.status === 'uploading'
              ? { ...f, progress: Math.min(f.progress + 10, 90) }
              : f
          )
        )
      }, 200)

      const result = await response.json()
      clearInterval(progressInterval)

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === upload.id
            ? {
                ...f,
                status: 'completed',
                progress: 100,
                assetId: result.data?.id,
              }
            : f
        )
      )

      // Check if all uploads are complete
      const completedAssets = files
        .filter((f) => f.status === 'completed' || f.id === upload.id)
        .map((f) => ({
          id: f.assetId || '',
          filename: f.file.name,
          url: `/api/assets/${f.assetId}/download`,
        }))

      onUploadComplete?.(completedAssets)
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === upload.id
            ? { ...f, status: 'error', error: err.message || 'Upload failed' }
            : f
        )
      )
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const retryUpload = (id: string) => {
    const file = files.find((f) => f.id === id)
    if (file) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, status: 'pending', error: undefined, progress: 0 } : f
        )
      )
      uploadFile({ ...file, status: 'pending', error: undefined, progress: 0 })
    }
  }

  const completedCount = files.filter((f) => f.status === 'completed').length
  const hasErrors = files.some((f) => f.status === 'error')

  return (
    <Box>
      {/* Drop Zone */}
      <Paper
        variant="outlined"
        sx={{
          p: 4,
          textAlign: 'center',
          border: '2px dashed',
          borderColor: isDragging ? 'primary.main' : 'divider',
          bgcolor: isDragging ? 'rgba(22, 51, 74, 0.05)' : 'background.paper',
          transition: 'all 0.2s',
          cursor: 'pointer',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'rgba(22, 51, 74, 0.02)',
          },
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h6" sx={{ mb: 1 }}>
          Drop files here or click to upload
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Supported: Images, Audio, Video, PDF (max {maxFileSize}MB each)
        </Typography>
        <Button variant="outlined" component="span">
          Select Files
        </Button>
        <input
          id="file-input"
          type="file"
          multiple={multiple}
          accept={allowedTypes.join(',')}
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
      </Paper>

      {/* Global Error */}
      {globalError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {globalError}
        </Alert>
      )}

      {/* File List */}
      {files.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2">
              Uploads ({completedCount}/{files.length} completed)
            </Typography>
            {hasErrors && (
              <Chip
                icon={<ErrorIcon />}
                label="Some uploads failed"
                size="small"
                color="error"
                variant="outlined"
              />
            )}
          </Box>

          <List>
            {files.map((file) => (
              <ListItem
                key={file.id}
                sx={{
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  mb: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <ListItemIcon>{getFileIcon(file.file.type)}</ListItemIcon>
                <ListItemText
                  primary={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {file.file.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {(file.file.size / 1024 / 1024).toFixed(2)} MB
                      </Typography>
                    </Box>
                  }
                  secondary={
                    file.status === 'uploading' ? (
                      <Box sx={{ mt: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={file.progress}
                          sx={{ height: 4, borderRadius: 1 }}
                        />
                      </Box>
                    ) : file.status === 'error' ? (
                      <Typography variant="caption" color="error">
                        {file.error}
                      </Typography>
                    ) : null
                  }
                />
                <ListItemSecondaryAction>
                  {file.status === 'completed' ? (
                    <Chip
                      icon={<CheckIcon />}
                      label="Done"
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                  ) : file.status === 'error' ? (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Button
                        size="small"
                        onClick={() => retryUpload(file.id)}
                        sx={{ minWidth: 'auto' }}
                      >
                        Retry
                      </Button>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => removeFile(file.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  ) : file.status === 'pending' ? (
                    <Chip label="Queued" size="small" variant="outlined" />
                  ) : null}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  )
}
