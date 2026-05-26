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

// Waits until navigator.onLine is true, or rejects after timeoutMs.
function waitForOnline(timeoutMs = 60_000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      resolve()
      return
    }
    const timer = setTimeout(() => {
      window.removeEventListener('online', handleOnline)
      reject(new Error('OFFLINE_TIMEOUT'))
    }, timeoutMs)

    const handleOnline = () => {
      clearTimeout(timer)
      resolve()
    }
    window.addEventListener('online', handleOnline, { once: true })
  })
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

  const { enqueueSnackbar, closeSnackbar } = useSnackbar()
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

  const pollUploadStatus = useCallback(async (
    assetId: string,
    runpodJobId: string
  ): Promise<Record<string, unknown>> => {
    const POLL_INTERVAL_MS = 3000
    const TIMEOUT_MS = 10 * 60 * 1000
    const OFFLINE_KEY = 'upload-offline-warn'
    const MAX_CONSECUTIVE_ERRORS = 5
    const deadline = Date.now() + TIMEOUT_MS
    let offlineWarningActive = false
    let consecutiveErrors = 0

    while (Date.now() < deadline) {
      // Pause while offline; wait up to the remaining deadline or 60s, whichever is less
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!offlineWarningActive) {
          enqueueSnackbar('Connection lost — will resume when back online', {
            variant: 'warning',
            persist: true,
            key: OFFLINE_KEY,
          })
          offlineWarningActive = true
        }

        const remaining = deadline - Date.now()
        const outcome = await waitForOnline(remaining)
          .then(() => 'online' as const)
          .catch(() => 'timeout' as const)

        closeSnackbar(OFFLINE_KEY)
        offlineWarningActive = false

        if (outcome === 'timeout') {
          throw new Error('Upload timed out. Please try uploading your audio sample again.')
        }
        // Dismiss of the persistent warning is sufficient feedback — no extra toast needed
      }

      await new Promise<void>(resolve => setTimeout(resolve, POLL_INTERVAL_MS))

      try {
        const response = await fetch(
          `/api/voice/upload-status?assetId=${encodeURIComponent(assetId)}&runpodJobId=${encodeURIComponent(runpodJobId)}`,
          { credentials: 'include' }
        )

        if (!response.ok) {
          consecutiveErrors++
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            const body = await response.json().catch(() => ({})) as { error?: string }
            throw new Error(body.error ?? `Status check failed (${response.status}) after ${MAX_CONSECUTIVE_ERRORS} attempts`)
          }
          continue
        }

        const status = await response.json() as {
          complete?: boolean
          failed?: boolean
          status?: string
          runpodStatus?: string
          delayTime?: number
          executionTime?: number
          data?: Record<string, unknown>
          error?: string
        }

        consecutiveErrors = 0

        if (status.complete) return status.data ?? { assetId }
        if (status.failed) throw new Error(status.error ?? 'Transcription failed')

        if (status.runpodStatus === 'IN_QUEUE') {
          enqueueSnackbar('Waiting for a transcription worker…', { variant: 'info', key: 'upload-progress', preventDuplicate: true })
        } else if (status.runpodStatus === 'IN_PROGRESS') {
          const elapsed = status.executionTime ? ` (${Math.round(status.executionTime / 1000)}s)` : ''
          enqueueSnackbar(`Transcribing audio${elapsed}…`, { variant: 'info', key: 'upload-progress', preventDuplicate: true })
        }
      } catch (err) {
        if (err instanceof TypeError) {
          // Network failure — navigator.onLine check on next iteration will handle it
          continue
        }
        throw err
      }
    }

    throw new Error('Voice sample transcription timed out')
  }, [enqueueSnackbar, closeSnackbar])

  const uploadTrainingSample = useCallback(async (file: File, _personId?: string) => {
    setState(prev => ({ ...prev, isUploading: true }))

    try {
      const csrfToken = await fetchToken()

      // Step 1: Request presigned PUT URL
      let assetId!: string
      let uploadUrl!: string
      {
        const MAX_RETRIES = 4
        let lastError: Error = new Error('Upload URL request failed')

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          if (attempt > 0) {
            // Wait for connectivity before retrying
            await waitForOnline(30_000).catch(() => {})
            await new Promise<void>(resolve => setTimeout(resolve, 500))
          }
          try {
            const res = await fetch('/api/voice/request-upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
              credentials: 'include',
              body: JSON.stringify({ filename: file.name, mimeType: file.type, fileSize: file.size }),
            })
            if (!res.ok) {
              const body = await res.json().catch(() => ({})) as { error?: string }
              throw new Error(body.error ?? 'Failed to request upload URL')
            }
            const data = await res.json() as { assetId: string; uploadUrl: string }
            assetId = data.assetId
            uploadUrl = data.uploadUrl
            break
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err))
            if (attempt === MAX_RETRIES - 1) throw lastError
          }
        }
      }

      // Step 2: PUT directly to R2 — no Vercel body size limit
      enqueueSnackbar('Uploading audio…', { variant: 'info' })
      {
        const MAX_RETRIES = 4
        let lastError: Error = new Error('Storage upload failed')

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          if (attempt > 0) {
            await waitForOnline(30_000).catch(() => {})
            await new Promise<void>(resolve => setTimeout(resolve, 500))
          }
          try {
            const res = await fetch(uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': file.type },
              body: file,
            })
            if (!res.ok) throw new Error(`Storage upload failed (${res.status})`)
            break
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err))
            if (attempt === MAX_RETRIES - 1) throw lastError
          }
        }
      }

      // Step 3: Kick off RunPod transcription job
      let runpodJobId!: string
      {
        const MAX_RETRIES = 4
        let lastError: Error = new Error('Failed to start transcription')

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          if (attempt > 0) {
            await waitForOnline(30_000).catch(() => {})
            await new Promise<void>(resolve => setTimeout(resolve, 500))
          }
          try {
            const res = await fetch('/api/voice/process-upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
              credentials: 'include',
              body: JSON.stringify({ assetId }),
            })
            if (!res.ok) {
              const body = await res.json().catch(() => ({})) as { error?: string }
              throw new Error(body.error ?? 'Failed to start transcription')
            }
            const data = await res.json() as { runpodJobId: string }
            runpodJobId = data.runpodJobId
            break
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err))
            if (attempt === MAX_RETRIES - 1) throw lastError
          }
        }
      }

      // Step 4: Poll until RunPod transcription completes (resilient to drops)
      enqueueSnackbar('File uploaded — transcribing audio…', { variant: 'info' })
      await pollUploadStatus(assetId, runpodJobId)

      setState(prev => ({
        ...prev,
        trainingSamples: [...prev.trainingSamples, { file, fileId: assetId }],
        isUploading: false,
      }))

      enqueueSnackbar('Sample uploaded successfully', { variant: 'success' })
    } catch (error) {
      setState(prev => ({ ...prev, isUploading: false }))
      const message = error instanceof Error ? error.message : 'Failed to upload sample'
      enqueueSnackbar(message, { variant: 'error' })
      throw error
    }
  }, [enqueueSnackbar, fetchToken, pollUploadStatus])

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
  }, [enqueueSnackbar, fetchToken])

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

      // Store design audio as the sample if the API returned one
      const persistedModelId = result.profileId || result.dbProfileId
      const designAudioUrl = result.designAudioUrl as string | undefined
      if (persistedModelId && designAudioUrl) {
        fetch(`/api/voice/profiles/${persistedModelId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
          credentials: 'include',
          body: JSON.stringify({ sampleAudioUrl: designAudioUrl }),
        }).catch(() => undefined)
      }

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
