import { useState, useCallback } from 'react'
import { AudioSample, VoiceCloneStatus, DocumentArtifact } from '@/types'
import { mockAudioSamples, mockVoiceCloneStatus, mockDocuments } from '@/data/mockData'
import { useToast } from '@/components/ToastProvider'

interface VoiceModel {
  id: string
  userId: string
  name: string
  status: 'training' | 'ready' | 'failed'
  language: string
  sampleCount: number
  createdAt: string
  modelPath?: string
}

interface TrainingJob {
  id: string
  modelId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  currentStage: string
  error?: string
  createdAt: string
  completedAt?: string
}

interface VoiceLabControllerState {
  audioSamples: AudioSample[]
  voiceCloneStatus: VoiceCloneStatus
  documents: DocumentArtifact[]
  voiceModels: VoiceModel[]
  selectedFilter: string
  isPlaying: string | null
  isRecording: boolean
  isUploading: boolean
  isLoading: boolean
  hasError: boolean
  errorMessage: string | null
  showRecordingModal: boolean
  trainingJob: TrainingJob | null
  isTraining: boolean
  trainingSamples: File[]
  // New states for preprocessing
  preprocessingStatus: 'idle' | 'processing' | 'completed' | 'failed'
  preprocessingProgress: number
  asrStatus: 'idle' | 'processing' | 'completed' | 'failed'
  queuePosition: number | null
  estimatedStartTime: Date | null
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
  // Voice cloning actions
  uploadTrainingSample: (file: File) => Promise<void>
  removeTrainingSample: (index: number) => void
  startVoiceTraining: (modelName: string, language: string) => Promise<void>
  checkTrainingStatus: (jobId: string) => Promise<void>
  synthesizeSpeech: (modelId: string, text: string) => Promise<string>
  loadVoiceModels: () => Promise<void>
  // New preprocessing actions
  preprocessSamples: (options: {
    noiseReduction: boolean
    voiceSeparation: boolean
  }) => Promise<void>
  runASR: (language: string) => Promise<void>
  checkQueueStatus: () => Promise<void>
  cancelTrainingJob: (jobId: string) => Promise<void>
}

export function useVoiceLabController(): VoiceLabControllerState & VoiceLabControllerActions {
  const [state, setState] = useState<VoiceLabControllerState>({
    audioSamples: mockAudioSamples,
    voiceCloneStatus: mockVoiceCloneStatus,
    documents: mockDocuments,
    voiceModels: [],
    selectedFilter: 'All',
    isPlaying: null,
    isRecording: false,
    isUploading: false,
    isLoading: false,
    hasError: false,
    errorMessage: null,
    showRecordingModal: false,
    trainingJob: null,
    isTraining: false,
    trainingSamples: [],
    // New states
    preprocessingStatus: 'idle',
    preprocessingProgress: 0,
    asrStatus: 'idle',
    queuePosition: null,
    estimatedStartTime: null,
  })

  const { showSuccess, showError } = useToast()

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
      
      showSuccess('Document uploaded successfully')
    } catch (error) {
      setState(prev => ({
        ...prev,
        isUploading: false,
        hasError: true,
        errorMessage: 'Failed to upload document',
      }))
      showError('Failed to upload document')
    }
  }, [showSuccess, showError])

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

  // Voice cloning methods
  const uploadTrainingSample = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, isUploading: true }))

    try {
      const formData = new FormData()
      formData.append('audio', file)
      formData.append('userId', 'user123') // Mock user ID

      const response = await fetch('/api/voice/upload-sample', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const result = await response.json()
      console.log('Upload response:', result)
      
      // Access the actual data from the API response wrapper
      const uploadData = result.data || result
      console.log('Upload data:', uploadData)
      
      // Store the file with its ID for later use in training
      const fileWithId = new File([file], file.name, { type: file.type })
      ;(fileWithId as any).fileId = uploadData.fileId
      ;(fileWithId as any).gptPath = uploadData.gptPath
      
      console.log('File with ID:', {
        name: file.name,
        fileId: uploadData.fileId,
        gptPath: uploadData.gptPath
      })
      
      setState(prev => ({
        ...prev,
        trainingSamples: [...prev.trainingSamples, fileWithId],
        isUploading: false,
      }))

      showSuccess('Sample uploaded successfully' + (uploadData.gptPath ? ' and sent to GPT-SoVITS' : ''))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isUploading: false,
        hasError: true,
        errorMessage: 'Failed to upload sample',
      }))
      showError('Failed to upload sample')
    }
  }, [showSuccess, showError])

  const removeTrainingSample = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      trainingSamples: prev.trainingSamples.filter((_, i) => i !== index),
    }))
  }, [])

  const startVoiceTraining = useCallback(async (modelName: string, language: string) => {
    console.log('Starting voice training with:', { modelName, language, sampleCount: state.trainingSamples.length })
    
    if (state.trainingSamples.length === 0) {
      showError('Please upload at least one audio sample')
      return
    }

    setState(prev => ({ ...prev, isTraining: true }))

    try {
      // Get the file IDs from uploaded samples
      const sampleFileIds: string[] = []
      console.log('Training samples:', state.trainingSamples)
      
      for (const file of state.trainingSamples) {
        const fileId = (file as any).fileId
        console.log('Processing file:', file.name, 'with ID:', fileId)
        if (fileId) {
          sampleFileIds.push(fileId)
        } else {
          console.warn('No file ID found for sample:', file.name)
        }
      }
      
      console.log('Collected file IDs:', sampleFileIds)
      
      if (sampleFileIds.length === 0) {
        showError('No valid audio samples found. Please re-upload your audio files.')
        setState(prev => ({ ...prev, isTraining: false }))
        return
      }
      
      const requestBody = {
        userId: 'user123',
        samples: sampleFileIds,
        language,
        modelName,
      }
      
      console.log('Sending training request:', requestBody)
      
      const response = await fetch('/api/voice/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      console.log('Training response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Training failed:', errorText)
        throw new Error(`Training failed to start: ${errorText}`)
      }

      const result = await response.json()
      console.log('Training started successfully:', result)
      
      setState(prev => ({
        ...prev,
        trainingJob: {
          id: result.jobId,
          modelId: result.modelId,
          status: result.status || 'queued',
          progress: 0,
          currentStage: 'queued',
          createdAt: new Date().toISOString(),
          usingRealGPT: result.usingRealGPT,
          gptJobId: result.gptJobId,
        },
        isTraining: false,
      }))

      showSuccess(result.usingRealGPT ? 'Voice training started with GPT-SoVITS!' : 'Voice training started!')
      
      // Start polling for status
      const pollStatus = setInterval(async () => {
        const statusResponse = await fetch(`/api/voice/train/${result.jobId}/status`)
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          setState(prev => ({
            ...prev,
            trainingJob: statusData,
          }))
          
          if (statusData.status === 'completed') {
            clearInterval(pollStatus)
            showSuccess('Voice training completed!')
            loadVoiceModels()
          } else if (statusData.status === 'failed') {
            clearInterval(pollStatus)
            showError(`Voice training failed: ${statusData.error || 'Unknown error'}`)
          }
        }
      }, 2000)
    } catch (error) {
      console.error('Training error:', error)
      setState(prev => ({
        ...prev,
        isTraining: false,
        hasError: true,
        errorMessage: 'Failed to start voice training',
      }))
      showError('Failed to start voice training')
    }
  }, [state.trainingSamples, showSuccess, showError])

  const checkTrainingStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/voice/train/${jobId}/status`)
      if (response.ok) {
        const statusData = await response.json()
        setState(prev => ({
          ...prev,
          trainingJob: statusData,
        }))
      }
    } catch (error) {
      console.error('Failed to check training status:', error)
    }
  }, [])

  const synthesizeSpeech = useCallback(async (modelId: string, text: string): Promise<string> => {
    try {
      const response = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId,
          text,
          language: 'en',
        }),
      })

      if (!response.ok) {
        throw new Error('Synthesis failed')
      }

      const result = await response.json()
      return result.audioUrl
    } catch (error) {
      console.error('Speech synthesis failed:', error)
      throw error
    }
  }, [])

  const loadVoiceModels = useCallback(async () => {
    try {
      const response = await fetch('/api/voice/models?userId=user123')
      if (response.ok) {
        const data = await response.json()
        setState(prev => ({
          ...prev,
          voiceModels: data.models,
        }))
      }
    } catch (error) {
      console.error('Failed to load voice models:', error)
    }
  }, [])

  // New preprocessing methods
  const preprocessSamples = useCallback(async (options: {
    noiseReduction: boolean
    voiceSeparation: boolean
  }) => {
    if (!state.trainingJob) return

    setState(prev => ({
      ...prev,
      preprocessingStatus: 'processing',
      preprocessingProgress: 0,
    }))

    try {
      const response = await fetch('/api/voice/preprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: state.trainingJob.id,
          sampleId: 'sample-1', // Mock sample ID
          processingOptions: options,
        }),
      })

      if (!response.ok) throw new Error('Preprocessing failed')

      const result = await response.json()
      
      setState(prev => ({
        ...prev,
        preprocessingStatus: 'completed',
        preprocessingProgress: 100,
      }))

      showSuccess('Audio preprocessing completed')
    } catch (error) {
      setState(prev => ({
        ...prev,
        preprocessingStatus: 'failed',
      }))
      showError('Failed to preprocess audio')
    }
  }, [state.trainingJob, showSuccess, showError])

  const runASR = useCallback(async (language: string) => {
    if (!state.trainingJob) return

    setState(prev => ({
      ...prev,
      asrStatus: 'processing',
    }))

    try {
      const response = await fetch('/api/voice/asr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: state.trainingJob.id,
          segments: [
            { id: 'seg-1', path: '/segments/seg_1.wav', duration: 10 },
            { id: 'seg-2', path: '/segments/seg_2.wav', duration: 10 },
            { id: 'seg-3', path: '/segments/seg_3.wav', duration: 10 },
          ],
          language,
          enableCorrection: true,
        }),
      })

      if (!response.ok) throw new Error('ASR failed')

      const result = await response.json()
      
      setState(prev => ({
        ...prev,
        asrStatus: 'completed',
      }))

      showSuccess('Speech-to-text completed')
    } catch (error) {
      setState(prev => ({
        ...prev,
        asrStatus: 'failed',
      }))
      showError('Failed to process speech-to-text')
    }
  }, [state.trainingJob, showSuccess, showError])

  const checkQueueStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/voice/queue?userId=user123')
      if (response.ok) {
        const data = await response.json()
        const userJob = data.queue.find((job: any) => job.userId === 'user123' && job.status === 'queued')
        
        setState(prev => ({
          ...prev,
          queuePosition: userJob?.queuePosition || null,
          estimatedStartTime: userJob?.estimatedStartTime ? new Date(userJob.estimatedStartTime) : null,
        }))
      }
    } catch (error) {
      console.error('Failed to check queue status:', error)
    }
  }, [])

  const cancelTrainingJob = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/voice/queue?jobId=${jobId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Cancel failed')

      setState(prev => ({
        ...prev,
        trainingJob: null,
        queuePosition: null,
        estimatedStartTime: null,
      }))

      showSuccess('Training job cancelled')
    } catch (error) {
      showError('Failed to cancel training job')
    }
  }, [showSuccess, showError])

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
    uploadTrainingSample,
    removeTrainingSample,
    startVoiceTraining,
    checkTrainingStatus,
    synthesizeSpeech,
    loadVoiceModels,
    preprocessSamples,
    runASR,
    checkQueueStatus,
    cancelTrainingJob,
  }
}
