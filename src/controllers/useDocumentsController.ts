import { useState, useCallback } from 'react'
import { DocumentArtifact } from '@/types'
import { mockDocuments } from '@/data/mockData'

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
}

export function useDocumentsController(): DocumentsControllerState & DocumentsControllerActions {
  const [state, setState] = useState<DocumentsControllerState>({
    documents: mockDocuments,
    selectedFilter: 'All',
    selectedDocuments: [],
    isLoading: false,
    hasError: false,
    errorMessage: null,
    isUploading: false,
    showShareDialog: false,
    shareDocumentId: null,
  })

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
      // Simulate upload
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const newDoc: DocumentArtifact = {
        id: Date.now().toString(),
        title: file.name,
        type: file.type.includes('pdf') ? 'PDF' : file.type.includes('image') ? 'Photo' : 'Handwritten',
        uploadedAt: new Date(),
        shareAction: 'Share',
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
  }, [])

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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setState(prev => ({
        ...prev,
        documents: prev.documents.filter(doc => doc.id !== id),
        selectedDocuments: prev.selectedDocuments.filter(docId => docId !== id),
        isLoading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage: 'Failed to delete document',
      }))
    }
  }, [])

  const refreshDocuments = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, hasError: false, errorMessage: null }))
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setState(prev => ({
        ...prev,
        documents: mockDocuments, // In real app, this would be fresh data
        isLoading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage: 'Failed to refresh documents',
      }))
    }
  }, [])

  const closeShareDialog = useCallback(() => {
    setState(prev => ({
      ...prev,
      showShareDialog: false,
      shareDocumentId: null,
    }))
  }, [])

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
  }
}
