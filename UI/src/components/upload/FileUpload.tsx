import { useState, useRef } from 'react'
import { Box, Typography, Button, CircularProgress, Snackbar, Alert } from '@mui/material'
import { CloudUpload as UploadIcon } from '@mui/icons-material'
import { fetchWithCSRFAndFormData } from '@/lib/api-client'

interface FileUploadProps {
  onUploadSuccess?: (result: any) => void
  onUploadError?: (error: string) => void
  accept?: string
  maxSize?: number // in bytes
  multiple?: boolean
  personId?: string
  children?: React.ReactNode
}

export function FileUpload({ 
  onUploadSuccess, 
  onUploadError, 
  accept = "*/*",
  maxSize = 100 * 1024 * 1024, // 100MB
  multiple = false,
  personId,
  children 
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    
    if (files.length === 0) return

    // Validate file sizes
    const oversizedFiles = files.filter(file => file.size > maxSize)
    if (oversizedFiles.length > 0) {
      const errorMsg = `Files too large: ${oversizedFiles.map(f => f.name).join(', ')} (max ${maxSize / 1024 / 1024}MB)`
      setError(errorMsg)
      onUploadError?.(errorMsg)
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      // Upload files one by one
      for (const file of files) {
        await uploadFile(file)
        setUploadProgress((prev) => prev + (100 / files.length))
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      setError(errorMessage)
      onUploadError?.(errorMessage)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const uploadFile = async (file: File): Promise<any> => {
    const formData = new FormData()
    formData.append('file', file)
    if (personId) formData.append('personId', personId)

    const response = await fetchWithCSRFAndFormData('/api/assets/upload', formData)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || `Upload failed: ${response.statusText}`)
    }

    const result = await response.json()
    onUploadSuccess?.(result)
    return result
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) {
      // Process files directly without creating a synthetic event
      setIsUploading(true)
      setError(null)

      try {
        // Validate file sizes
        const oversizedFiles = files.filter(file => file.size > maxSize)
        if (oversizedFiles.length > 0) {
          const errorMsg = `Files too large: ${oversizedFiles.map(f => f.name).join(', ')} (max ${maxSize / 1024 / 1024}MB)`
          setError(errorMsg)
          onUploadError?.(errorMsg)
          return
        }

        // Upload files one by one
        for (const file of files) {
          await uploadFile(file)
          setUploadProgress((prev) => prev + (100 / files.length))
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed'
        setError(errorMessage)
        onUploadError?.(errorMessage)
      } finally {
        setIsUploading(false)
        setUploadProgress(0)
      }
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      
      <Box
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        sx={{
          cursor: isUploading ? 'not-allowed' : 'pointer',
          position: 'relative',
          userSelect: 'none'
        }}
      >
        {isUploading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'inherit',
              zIndex: 1
            }}
          >
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Uploading... {Math.round(uploadProgress)}%
            </Typography>
          </Box>
        )}
        
        {children}
      </Box>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setError(null)} 
          severity="error"
          sx={{ width: '100%' }}
        >
          {error}
        </Alert>
      </Snackbar>
    </>
  )
}

// Standalone upload button component
export function UploadButton({ 
  onUploadSuccess, 
  onUploadError,
  accept = "*/*",
  maxSize = 100 * 1024 * 1024
}: Omit<FileUploadProps, 'children' | 'multiple'>) {
  return (
    <FileUpload
      onUploadSuccess={onUploadSuccess}
      onUploadError={onUploadError}
      accept={accept}
      maxSize={maxSize}
      multiple={false}
    >
      <Button
        variant="contained"
        startIcon={<UploadIcon />}
        disabled={false}
        sx={{
          backgroundColor: '#16334a',
          '&:hover': {
            backgroundColor: '#2e4a62',
          }
        }}
      >
        Upload File
      </Button>
    </FileUpload>
  )
}
