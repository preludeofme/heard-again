import { useState, useCallback } from 'react'
import { useSnackbar } from 'notistack'
import { useCSRF } from '@/hooks/useCSRF'

interface TrainingSample {
  file: File
  fileId: string
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

interface VoiceTrainingState {
  trainingSamples: TrainingSample[]
  isTraining: boolean
  trainingJob: TrainingJob | null
  isUploading: boolean
  // Preprocessing states
  preprocessingStatus: 'idle' | 'processing' | 'completed' | 'failed'
  preprocessingProgress: number
  asrStatus: 'idle' | 'processing' | 'completed' | 'failed'
  queuePosition: number | null
  estimatedStartTime: Date | null
}

interface VoiceTrainingActions {
  uploadTrainingSample: (file: File, personId?: string) => Promise<void>
  removeTrainingSample: (index: number) => void
  startVoiceTraining: (modelName: string, language: string, styleInstruct?: string, personId?: string) => Promise<void>
  checkTrainingStatus: (jobId: string) => Promise<void>
  cancelTrainingJob: (jobId: string) => Promise<void>
  preprocessSamples: (options: { noiseReduction: boolean; voiceSeparation: boolean }) => Promise<void>
  runASR: (language: string) => Promise<void>
  designAndCloneVoice: (profileName: string, instruct: string, refText: string, language?: string) => Promise<void>
  resetTraining: () => void
}

export function useVoiceTraining(): VoiceTrainingState & VoiceTrainingActions {
  const [state, setState] = useState<VoiceTrainingState>({
    trainingSamples: [],
    isTraining: false,
    trainingJob: null,
    isUploading: false,
    preprocessingStatus: 'idle',
    preprocessingProgress: 0,
    asrStatus: 'idle',
    queuePosition: null,
    estimatedStartTime: null,
  })

  const { enqueueSnackbar } = useSnackbar()
  const { fetchToken } = useCSRF()

  const resetTraining = useCallback(() => {
    setState(prev => ({
      ...prev,
      trainingSamples: [],
      isTraining: false,
      trainingJob: null,
      isUploading: false,
      preprocessingStatus: 'idle',
      preprocessingProgress: 0,
      asrStatus: 'idle',
      queuePosition: null,
      estimatedStartTime: null,
    }))
  }, [])

  const uploadTrainingSample = useCallback(async (file: File, personId?: string) => {
    setState(prev => ({ ...prev, isUploading: true }))

    try {
      const csrfToken = await fetchToken()
      const formData = new FormData()
      formData.append('audio', file)
      if (personId) {
        formData.append('personId', personId)
      }

      const response = await fetch('/api/voice/upload-sample', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken
        },
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const result = await response.json()
      const uploadData = result.data || result

      const newSample: TrainingSample = {
        file,
        fileId: uploadData.assetId,
      }

      setState(prev => ({
        ...prev,
        trainingSamples: [...prev.trainingSamples, newSample],
        isUploading: false,
      }))

      enqueueSnackbar('Sample uploaded successfully', { variant: 'success' })
    } catch (error) {
      setState(prev => ({ ...prev, isUploading: false }))
      enqueueSnackbar('Failed to upload sample', { variant: 'error' })
      throw error
    }
  }, [enqueueSnackbar, fetchToken])

  const removeTrainingSample = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      trainingSamples: prev.trainingSamples.filter((_, i) => i !== index),
    }))
  }, [])

  const startVoiceTraining = useCallback(async (
    modelName: string,
    language: string,
    styleInstruct?: string,
    personId?: string
  ) => {
    if (state.trainingSamples.length === 0) {
      enqueueSnackbar('Please upload at least one audio sample', { variant: 'error' })
      return
    }

    setState(prev => ({ ...prev, isTraining: true }))

    try {
      const csrfToken = await fetchToken()
      const sampleFileIds = state.trainingSamples.map(s => s.fileId).filter(Boolean)

      if (sampleFileIds.length === 0) {
        enqueueSnackbar('No valid audio samples found. Please re-upload your audio files.', { variant: 'error' })
        setState(prev => ({ ...prev, isTraining: false }))
        return
      }

      const requestBody = {
        samples: sampleFileIds,
        language,
        modelName,
        styleInstruct: styleInstruct || null,
        personId: personId || null,
      }

      const response = await fetch('/api/voice/train', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Voice profile creation failed')
      }

      const persistedModelId = result.dbProfileId || result.modelId

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
      }))

      enqueueSnackbar('Voice profile created! You can now use it in Talk.', { variant: 'success' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create voice profile'
      setState(prev => ({
        ...prev,
        isTraining: false,
      }))
      enqueueSnackbar(message, { variant: 'error' })
      throw error
    }
  }, [state.trainingSamples, enqueueSnackbar, fetchToken])

  const checkTrainingStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/voice/train/${jobId}/status`, { credentials: 'include' })
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

  const cancelTrainingJob = useCallback(async (jobId: string) => {
    try {
      const csrfToken = await fetchToken()
      const response = await fetch(`/api/voice/queue?jobId=${jobId}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken },
        credentials: 'include',
      })

      if (!response.ok) throw new Error('Cancel failed')

      setState(prev => ({
        ...prev,
        trainingJob: null,
        queuePosition: null,
        estimatedStartTime: null,
      }))

      enqueueSnackbar('Training job cancelled')
    } catch (error) {
      enqueueSnackbar('Failed to cancel training job')
      throw error
    }
  }, [enqueueSnackbar])

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
      const csrfToken = await fetchToken()
      const response = await fetch('/api/voice/preprocess', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          jobId: state.trainingJob.id,
          sampleId: 'sample-1',
          processingOptions: options,
        }),
      })

      if (!response.ok) throw new Error('Preprocessing failed')

      setState(prev => ({
        ...prev,
        preprocessingStatus: 'completed',
        preprocessingProgress: 100,
      }))

      enqueueSnackbar('Audio preprocessing completed')
    } catch (error) {
      setState(prev => ({ ...prev, preprocessingStatus: 'failed' }))
      enqueueSnackbar('Failed to preprocess audio')
      throw error
    }
  }, [state.trainingJob, enqueueSnackbar, fetchToken])

  const runASR = useCallback(async (language: string) => {
    if (!state.trainingJob) return

    setState(prev => ({ ...prev, asrStatus: 'processing' }))

    try {
      const csrfToken = await fetchToken()
      const response = await fetch('/api/voice/asr', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        credentials: 'include',
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

      setState(prev => ({ ...prev, asrStatus: 'completed' }))
      enqueueSnackbar('Speech-to-text completed')
    } catch (error) {
      setState(prev => ({ ...prev, asrStatus: 'failed' }))
      enqueueSnackbar('Failed to process speech-to-text')
      throw error
    }
  }, [state.trainingJob, enqueueSnackbar, fetchToken])

  const designAndCloneVoice = useCallback(async (
    profileName: string,
    instruct: string,
    refText: string,
    language: string = 'English',
  ) => {
    setState(prev => ({ ...prev, isTraining: true }))

    try {
      const csrfToken = await fetchToken()
      const response = await fetch('/api/voice/design-and-clone', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({ profileName, instruct, refText, language }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Voice design failed: ${errorText}`)
      }

      const result = await response.json()

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

      enqueueSnackbar(`Voice "${profileName}" designed and saved!`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to design voice'
      setState(prev => ({ ...prev, isTraining: false }))
      enqueueSnackbar(message, { variant: 'error' })
      throw error
    }
  }, [enqueueSnackbar, fetchToken])

  return {
    ...state,
    uploadTrainingSample,
    removeTrainingSample,
    startVoiceTraining,
    checkTrainingStatus,
    cancelTrainingJob,
    preprocessSamples,
    runASR,
    designAndCloneVoice,
    resetTraining,
  }
}
