import { useState, useCallback } from 'react'
import { AudioSample, VoiceCloneStatus, DocumentArtifact } from '@/types'
import { mockAudioSamples, mockVoiceCloneStatus, mockDocuments } from '@/data/mockData'

interface VoiceLabControllerState {
  audioSamples: AudioSample[]
  voiceCloneStatus: VoiceCloneStatus
  documents: DocumentArtifact[]
  selectedFilter: string
  isPlaying: string | null
  isRecording: boolean
  isUploading: boolean
  isLoading: boolean
  hasError: boolean
  errorMessage: string | null
  showRecordingModal: boolean
}

interface VoiceLabControllerActions {
  setSelectedFilter: (filter: string) => void
  togglePlaySample: (id: string) => void
  startRecording: () => void
  stopRecording: () => void
  uploadDocument: (file: File) => Promise<void>
  shareDocument: (id: string) => void
  refreshData: () => Promise<void>
  toggleRecordingModal: () => void
}

export function useVoiceLabController(): VoiceLabControllerState & VoiceLabControllerActions {
  const [state, setState] = useState<VoiceLabControllerState>({
    audioSamples: mockAudioSamples,
    voiceCloneStatus: mockVoiceCloneStatus,
    documents: mockDocuments,
    selectedFilter: 'All',
    isPlaying: null,
    isRecording: false,
    isUploading: false,
    isLoading: false,
    hasError: false,
    errorMessage: null,
    showRecordingModal: false,
  })

  const setSelectedFilter = useCallback((filter: string) => {
    setState(prev => ({ ...prev, selectedFilter: filter }))
  }, [])

  const togglePlaySample = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      isPlaying: prev.isPlaying === id ? null : id,
    }))
  }, [])

  const startRecording = useCallback(() => {
    setState(prev => ({ ...prev, isRecording: true }))
    // In a real app, this would start audio recording
    console.log('Starting recording...')
  }, [])

  const stopRecording = useCallback(() => {
    setState(prev => ({ ...prev, isRecording: false }))
    // In a real app, this would stop recording and upload the sample
    console.log('Stopping recording...')
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
    const doc = state.documents.find(d => d.id === id)
    if (doc) {
      // In a real app, this would trigger share functionality
      console.log('Sharing document:', doc.title)
    }
  }, [state.documents])

  const refreshData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, hasError: false, errorMessage: null }))
    
    try {
      // Simulate API calls
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setState(prev => ({
        ...prev,
        audioSamples: mockAudioSamples,
        voiceCloneStatus: mockVoiceCloneStatus,
        documents: mockDocuments,
        isLoading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage: 'Failed to refresh data',
      }))
    }
  }, [])

  const toggleRecordingModal = useCallback(() => {
    setState(prev => ({ ...prev, showRecordingModal: !prev.showRecordingModal }))
  }, [])

  return {
    ...state,
    setSelectedFilter,
    togglePlaySample,
    startRecording,
    stopRecording,
    uploadDocument,
    shareDocument,
    refreshData,
    toggleRecordingModal,
  }
}
