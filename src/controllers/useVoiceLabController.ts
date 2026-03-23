import { useState, useCallback, useEffect } from 'react'
import { AudioSample, VoiceCloneStatus, DocumentArtifact } from '@/types'
import { useToast } from '@/components/feedback/ToastProvider'

interface VoiceModel {
  id: string
  userId: string
  name: string
  displayName?: string
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
  startVoiceTraining: (modelName: string, language: string, styleInstruct?: string) => Promise<void>
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
  designAndCloneVoice: (profileName: string, instruct: string, refText: string, language?: string) => Promise<void>
  blendVoiceProfile: (profileName: string, instruct: string, styleRefText?: string, language?: string) => Promise<void>
  deleteVoiceProfile: (profileId: string) => Promise<void>
}

export function useVoiceLabController(): VoiceLabControllerState & VoiceLabControllerActions {
  const [state, setState] = useState<VoiceLabControllerState>({
    audioSamples: [],
    voiceCloneStatus: { percentComplete: 0, uploadedCount: 0, remainingCount: 0, statusText: 'No voice profiles yet' },
    documents: [],
    voiceModels: [],
    selectedFilter: 'All',
    isPlaying: null,
    isRecording: false,
    isUploading: false,
    isLoading: true,
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
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Upload failed')

      const mimeType = data.data.mimeType || file.type
      const newDoc: DocumentArtifact = {
        id: data.data.id,
        title: data.data.originalName || file.name,
        type: mimeType.includes('pdf') ? 'PDF' : mimeType.includes('image') ? 'Photo' : 'Letter',
        uploadedAt: new Date(data.data.createdAt),
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
      // Fetch voice profiles and documents in parallel
      const [profilesRes, assetsRes] = await Promise.all([
        fetch('/api/voice/profiles'),
        fetch('/api/assets'),
      ])

      const profilesData = profilesRes.ok ? await profilesRes.json() : null
      const assetsData = assetsRes.ok ? await assetsRes.json() : null

      const profiles = profilesData?.success ? (profilesData.data || []) : []
      const assets = assetsData?.success ? (assetsData.data?.assets || []) : []

      const voiceModels: VoiceModel[] = profiles.map((p: any) => ({
        id: p.id,
        userId: '',
        name: p.name,
        displayName: p.displayName || p.name,
        status: (p.status || 'READY').toLowerCase() === 'ready' ? 'ready' as const : 'training' as const,
        language: p.language || 'en',
        sampleCount: p.sampleCount || 0,
        createdAt: p.createdAt,
        modelPath: p.modelPath,
      }))

      const documents: DocumentArtifact[] = assets.map((a: any) => ({
        id: a.id,
        title: a.originalName || a.filename,
        type: (a.mimeType || '').includes('pdf') ? 'PDF' as const
          : (a.mimeType || '').includes('image') ? 'Photo' as const
          : 'Letter' as const,
        uploadedAt: new Date(a.createdAt),
        shareAction: 'Share',
      }))

      setState(prev => ({
        ...prev,
        voiceModels,
        documents,
        voiceCloneStatus: {
          percentComplete: voiceModels.length > 0 ? 100 : 0,
          uploadedCount: voiceModels.length,
          remainingCount: 0,
          statusText: voiceModels.length > 0
            ? `${voiceModels.length} voice profile${voiceModels.length > 1 ? 's' : ''} ready`
            : 'No voice profiles yet',
        },
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

  // Load data on mount
  useEffect(() => {
    refreshData()
  }, [refreshData])

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
      
      console.log('File with ID:', {
        name: file.name,
        fileId: uploadData.fileId
      })
      
      setState(prev => ({
        ...prev,
        trainingSamples: [...prev.trainingSamples, fileWithId],
        isUploading: false,
      }))

      showSuccess('Sample uploaded successfully')
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

  const startVoiceTraining = useCallback(async (modelName: string, language: string, styleInstruct?: string) => {
    console.log('Starting voice profile creation with:', { modelName, language, sampleCount: state.trainingSamples.length })
    
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
        styleInstruct: styleInstruct || null,
      }
      
      console.log('Sending voice profile creation request:', requestBody)
      
      const response = await fetch('/api/voice/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      console.log('Voice profile response status:', response.status)
      
      const result = await response.json()

      if (!response.ok || !result.success) {
        const message = result.error || 'Voice profile creation failed'
        console.error('Voice profile creation failed:', message)
        throw new Error(message)
      }

      console.log('Voice profile created successfully:', result)
      const persistedModelId = result.dbProfileId || result.modelId
      
      // Qwen3-TTS creates voice profiles nearly instantly (no long training)
      setState(prev => ({
        ...prev,
        trainingJob: {
          id: result.jobId || persistedModelId,
          modelId: persistedModelId,
          status: 'completed',
          progress: 100,
          currentStage: 'completed',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
        isTraining: false,
        trainingSamples: [],
        hasError: false,
        errorMessage: null,
      }))

      showSuccess('Voice profile created! You can now use it in Talk.')
      
      // Refresh voice models list
      loadVoiceModels()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create voice profile'
      console.error('Voice profile creation error:', error)
      setState(prev => ({
        ...prev,
        isTraining: false,
        hasError: true,
        errorMessage: message,
      }))
      showError(message)
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
      const response = await fetch('/api/voice/profiles')
      if (response.ok) {
        const data = await response.json()
        const profiles = data.success ? (data.data || []) : []
        setState(prev => ({
          ...prev,
          voiceModels: profiles.map((p: any) => ({
            id: p.id,
            userId: '',
            name: p.name,
            displayName: p.displayName || p.name,
            status: (p.status || 'READY').toLowerCase() === 'ready' ? 'ready' as const : 'training' as const,
            language: p.language || 'en',
            sampleCount: p.sampleCount || 0,
            createdAt: p.createdAt,
            modelPath: p.modelPath,
          })),
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

  const designAndCloneVoice = useCallback(async (
    profileName: string,
    instruct: string,
    refText: string,
    language: string = 'English',
  ) => {
    setState(prev => ({ ...prev, isTraining: true }))

    try {
      const response = await fetch('/api/voice/design-and-clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileName, instruct, refText, language }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Voice design failed: ${errorText}`)
      }

      const result = await response.json()
      console.log('Voice design+clone result:', result)

      setState(prev => ({
        ...prev,
        trainingJob: {
          id: result.profileId,
          modelId: result.profileId,
          status: 'completed',
          progress: 100,
          currentStage: 'completed',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
        isTraining: false,
      }))

      showSuccess(`Voice "${profileName}" designed and saved! You can now use it in Talk.`)
      loadVoiceModels()
    } catch (error) {
      console.error('Design-and-clone error:', error)
      setState(prev => ({
        ...prev,
        isTraining: false,
        hasError: true,
        errorMessage: 'Failed to design voice',
      }))
      showError('Failed to design voice')
    }
  }, [showSuccess, showError])

  const blendVoiceProfile = useCallback(async (
    profileName: string,
    instruct: string,
    styleRefText?: string,
    language: string = 'English',
  ) => {
    if (state.trainingSamples.length === 0) {
      showError('Please upload a reference audio sample first')
      return
    }

    setState(prev => ({ ...prev, isTraining: true }))

    try {
      const fileIds = state.trainingSamples.map(s => (s as any).fileId).filter(Boolean)
      if (fileIds.length === 0) {
        throw new Error('No uploaded samples found')
      }

      const response = await fetch('/api/voice/blend-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: fileIds[0],
          instruct,
          styleRefText,
          profileName,
          language,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Blend failed: ${errorText}`)
      }

      const result = await response.json()
      console.log('Blend voice result:', result)

      setState(prev => ({
        ...prev,
        trainingJob: {
          id: result.profileId,
          modelId: result.profileId,
          status: 'completed',
          progress: 100,
          currentStage: 'completed',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
        isTraining: false,
      }))

      showSuccess(`Blended voice "${profileName}" created! Real identity + designed style.`)
      loadVoiceModels()
    } catch (error) {
      console.error('Blend voice error:', error)
      setState(prev => ({
        ...prev,
        isTraining: false,
        hasError: true,
        errorMessage: 'Failed to create blended voice profile',
      }))
      showError('Failed to create blended voice profile')
    }
  }, [state.trainingSamples, showSuccess, showError])

  const deleteVoiceProfile = useCallback(async (profileId: string) => {
    try {
      const response = await fetch(`/api/voice/profiles/${profileId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Delete failed: ${errorText}`)
      }

      setState(prev => ({
        ...prev,
        voiceModels: prev.voiceModels.filter(m => m.id !== profileId),
      }))

      showSuccess('Voice profile deleted')
    } catch (error) {
      console.error('Failed to delete voice profile:', error)
      showError('Failed to delete voice profile')
    }
  }, [showSuccess, showError])

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
    designAndCloneVoice,
    blendVoiceProfile,
    deleteVoiceProfile,
  }
}
