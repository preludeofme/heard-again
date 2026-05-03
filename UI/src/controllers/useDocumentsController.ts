import { useState, useCallback, useEffect } from 'react'
import { DocumentArtifact } from '@/types'
import { ApiError } from '@/lib/errors'
import { getDocumentTypeFromMimeType } from '@/mappers/documentMapper'
import { getCSRFToken } from '@/lib/api-client'

interface DocumentsControllerState {
  documents: DocumentArtifact[]
  selectedFilter: string
  selectedDocuments: string[]
  isLoading: boolean
  hasError: boolean
  errorMessage: string | null
  isUploading: boolean
  showShareDialog: boolean
  shareDocumentId: string | null
}

interface DocumentsControllerActions {
  setSelectedFilter: (filter: string) => void
  toggleDocumentSelection: (id: string) => void
  selectAllDocuments: () => void
  clearSelection: () => void
  uploadDocument: (file: File) => Promise<void>
  shareDocument: (id: string) => void
  deleteDocument: (id: string) => Promise<void>
  refreshDocuments: () => Promise<void>
  closeShareDialog: () => void
  linkDocument: (assetId: string) => Promise<void>
}

interface AssetApiResponse {
  id: string
  originalName: string
  filename: string
  mimeType: string
  createdAt: string
  linkedToPerson?: boolean
}

export function useDocumentsController(personId?: string): DocumentsControllerState & DocumentsControllerActions {
  const [state, setState] = useState<DocumentsControllerState>({
    documents: [],
    selectedFilter: 'All',
    selectedDocuments: [],
    isLoading: true,
    hasError: false,
    errorMessage: null,
    isUploading: false,
    showShareDialog: false,
    shareDocumentId: null,
  })

  const fetchDocuments = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, hasError: false, errorMessage: null }))

    try {
      const url = personId ? `/api/assets?personId=${encodeURIComponent(personId)}` : '/api/assets'
      const response = await fetch(url, { credentials: 'include' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load documents')
      }

      const documents: DocumentArtifact[] = (data.data.assets || []).map((a: AssetApiResponse) => ({
        id: a.id,
        title: a.originalName || a.filename,
        type: getDocumentTypeFromMimeType(a.mimeType),
        mimeType: a.mimeType,
        uploadedAt: new Date(a.createdAt),
        shareAction: 'Share',
        linkedToPerson: a.linkedToPerson,
      }))

      setState(prev => ({ ...prev, documents, isLoading: false }))
    } catch (error) {
      const apiError = ApiError.fromError(error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage: apiError.message,
      }))
    }
  }, [personId])

  // Load on mount or when personId changes
  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments, personId])

  const setSelectedFilter = useCallback((filter: string) => {
    setState(prev => ({ ...prev, selectedFilter: filter }))
  }, [])

  const toggleDocumentSelection = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      selectedDocuments: prev.selectedDocuments.includes(id)
        ? prev.selectedDocuments.filter(docId => docId !== id)
        : [...prev.selectedDocuments, id],
    }))
  }, [])

  const selectAllDocuments = useCallback(() => {
    const filtered = state.documents.filter(doc => 
      state.selectedFilter === 'All' || doc.type === state.selectedFilter
    )
    setState(prev => ({
      ...prev,
      selectedDocuments: filtered.map(doc => doc.id),
    }))
  }, [state.documents, state.selectedFilter])

  const clearSelection = useCallback(() => {
    setState(prev => ({ ...prev, selectedDocuments: [] }))
  }, [])

  const uploadDocument = useCallback(async (file: File) => {
    setState(prev => ({ 
      ...prev, 
      isUploading: true, 
      hasError: false, 
      errorMessage: null 
    }))

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (personId) {
        formData.append('personId', personId)
      }

      const csrfToken = await getCSRFToken()
      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': csrfToken },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Upload failed')
      }

      // Add the new asset to the list immediately
      const newDoc: DocumentArtifact = {
        id: data.data.id,
        title: data.data.originalName || file.name,
        type: getDocumentTypeFromMimeType(data.data.mimeType || file.type),
        mimeType: data.data.mimeType || file.type,
        uploadedAt: new Date(data.data.createdAt),
        shareAction: 'Share',
        linkedToPerson: !!personId,
      }

      setState(prev => ({
        ...prev,
        documents: [newDoc, ...prev.documents],
        isUploading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isUploading: false,
        hasError: true,
        errorMessage: 'Failed to upload document',
      }))
    }
  }, [personId])

  const shareDocument = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      showShareDialog: true,
      shareDocumentId: id,
    }))
  }, [])

  const deleteDocument = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, isLoading: true, hasError: false, errorMessage: null }))
    
    try {
      const csrfToken = await getCSRFToken()
      const response = await fetch(`/api/assets/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'x-csrf-token': csrfToken },
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete document')
      }
      
      setState(prev => ({
        ...prev,
        documents: prev.documents.filter(doc => doc.id !== id),
        selectedDocuments: prev.selectedDocuments.filter(docId => docId !== id),
        isLoading: false,
      }))
    } catch (error) {
      const apiError = ApiError.fromError(error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage: apiError.message,
      }))
    }
  }, [])

  const refreshDocuments = useCallback(async () => {
    await fetchDocuments()
  }, [fetchDocuments])

  const closeShareDialog = useCallback(() => {
    setState(prev => ({
      ...prev,
      showShareDialog: false,
      shareDocumentId: null,
    }))
  }, [])

  const linkDocument = useCallback(async (assetId: string) => {
    if (!personId) return
    try {
      const csrfToken = await getCSRFToken()
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ personId, action: 'link' }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to link document')
      }
      setState(prev => ({
        ...prev,
        documents: prev.documents.map(doc =>
          doc.id === assetId ? { ...doc, linkedToPerson: true } : doc
        ),
      }))
    } catch (error) {
      const apiError = ApiError.fromError(error)
      setState(prev => ({ ...prev, hasError: true, errorMessage: apiError.message }))
    }
  }, [personId])

  return {
    ...state,
    setSelectedFilter,
    toggleDocumentSelection,
    selectAllDocuments,
    clearSelection,
    uploadDocument,
    shareDocument,
    deleteDocument,
    refreshDocuments,
    closeShareDialog,
    linkDocument,
  }
}
