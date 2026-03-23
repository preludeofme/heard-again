/**
 * useDocumentUpload Hook
 * Finding 5.4: Split useVoiceLabController - Focused hook for document uploads
 * Responsibility: File upload with progress tracking
 */

import { useState, useCallback } from 'react'
import type { DocumentArtifact } from '@/types'
import { toDocumentArtifact } from '@/mappers'
import { useToast } from '@/components/feedback/ToastProvider'

interface DocumentUploadState {
  documents: DocumentArtifact[]
  isUploading: boolean
  uploadProgress: number
}

interface DocumentUploadActions {
  uploadDocument: (file: File) => Promise<void>
  shareDocument: (id: string) => void
  refreshDocuments: () => Promise<void>
}

export function useDocumentUpload(): DocumentUploadState & DocumentUploadActions {
  const [state, setState] = useState<DocumentUploadState>({
    documents: [],
    isUploading: false,
    uploadProgress: 0,
  })

  const { showSuccess, showError } = useToast()

  const uploadDocument = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, isUploading: true, uploadProgress: 0 }))

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Simulate progress for UX (replace with real progress tracking if needed)
      const progressInterval = setInterval(() => {
        setState(prev => ({
          ...prev,
          uploadProgress: Math.min(prev.uploadProgress + 10, 90),
        }))
      }, 100)

      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Upload failed')
      }

      const newDoc = toDocumentArtifact({
        id: data.data.id,
        filename: data.data.filename,
        originalName: data.data.originalName || file.name,
        mimeType: data.data.mimeType || file.type,
        createdAt: data.data.createdAt,
      })

      setState(prev => ({
        ...prev,
        documents: [newDoc, ...prev.documents],
        isUploading: false,
        uploadProgress: 100,
      }))

      showSuccess('Document uploaded successfully')
    } catch (error) {
      setState(prev => ({ ...prev, isUploading: false, uploadProgress: 0 }))
      showError('Failed to upload document')
      throw error
    }
  }, [showSuccess, showError])

  const shareDocument = useCallback((id: string) => {
    const doc = state.documents.find(d => d.id === id)
    if (doc) {
      // In a real app, this would trigger share functionality
      console.log('Sharing document:', doc.title)
    }
  }, [state.documents])

  const refreshDocuments = useCallback(async () => {
    try {
      const response = await fetch('/api/assets')
      if (!response.ok) throw new Error('Failed to fetch documents')

      const data = await response.json()
      const assets = data.success ? (data.data?.assets || []) : []

      const documents = assets.map((asset: {
        id: string
        filename: string
        originalName?: string
        mimeType?: string
        createdAt: string | Date
      }) => toDocumentArtifact(asset))

      setState(prev => ({ ...prev, documents }))
    } catch (error) {
      console.error('Failed to refresh documents:', error)
    }
  }, [])

  return {
    ...state,
    uploadDocument,
    shareDocument,
    refreshDocuments,
  }
}
