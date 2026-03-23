import { useState, useCallback, useEffect } from 'react'
import { StoryContribution } from '@/types'

interface StoriesControllerState {
  stories: StoryContribution[]
  isSubmitting: boolean
  isLoading: boolean
  hasError: boolean
  errorMessage: string | null
  formTitle: string
  formContent: string
  formType: 'text' | 'audio'
}

interface StoriesControllerActions {
  setFormTitle: (title: string) => void
  setFormContent: (content: string) => void
  setFormType: (type: 'text' | 'audio') => void
  submitStory: (title?: string, content?: string) => Promise<void>
  submitAudioStory: (audioBlob: Blob, duration: number, title?: string) => Promise<void>
  refreshStories: () => Promise<void>
  clearForm: () => void
}

export function useStoriesController(): StoriesControllerState & StoriesControllerActions {
  const [state, setState] = useState<StoriesControllerState>({
    stories: [],
    isSubmitting: false,
    isLoading: true,
    hasError: false,
    errorMessage: null,
    formTitle: '',
    formContent: '',
    formType: 'text',
  })

  const fetchStories = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, hasError: false, errorMessage: null }))

    try {
      const response = await fetch('/api/stories')
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load stories')
      }

      // Map API response to StoryContribution format
      const stories: StoryContribution[] = (data.data.stories || []).map((s: any) => ({
        id: s.id,
        authorName: s.createdBy?.displayName || s.createdBy?.email || 'Unknown',
        authorRole: 'Family',
        authorAvatarUrl: undefined,
        content: s.excerpt || s.title,
        createdAt: new Date(s.createdAt),
        type: s.hasAudio ? 'audio' : 'text',
        audioDurationSeconds: undefined,
      }))

      setState(prev => ({ ...prev, stories, isLoading: false }))
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage: error.message || 'Failed to load stories',
      }))
    }
  }, [])

  // Load on mount
  useEffect(() => {
    fetchStories()
  }, [fetchStories])

  const setFormTitle = useCallback((title: string) => {
    setState(prev => ({ ...prev, formTitle: title }))
  }, [])

  const setFormContent = useCallback((content: string) => {
    setState(prev => ({ ...prev, formContent: content }))
  }, [])

  const setFormType = useCallback((type: 'text' | 'audio') => {
    setState(prev => ({ ...prev, formType: type }))
  }, [])

  const submitStory = useCallback(async (titleOverride?: string, contentOverride?: string) => {
    const title = titleOverride ?? state.formTitle
    const content = contentOverride ?? state.formContent

    if (!title.trim() || !content.trim()) {
      setState(prev => ({
        ...prev,
        hasError: true,
        errorMessage: 'Please fill in all fields',
      }))
      return
    }

    setState(prev => ({ 
      ...prev, 
      isSubmitting: true, 
      hasError: false, 
      errorMessage: null 
    }))

    try {
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          storyType: state.formType === 'audio' ? 'AUDIO_RECORDING' : 'MEMORY',
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create story')
      }

      // Refresh the stories list to get the new story
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        formTitle: '',
        formContent: '',
      }))
      await fetchStories()
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        hasError: true,
        errorMessage: error.message || 'Failed to submit story. Please try again.',
      }))
    }
  }, [state.formTitle, state.formContent, state.formType, fetchStories])

  const refreshStories = useCallback(async () => {
    await fetchStories()
  }, [fetchStories])

  const submitAudioStory = useCallback(async (audioBlob: Blob, duration: number, title?: string) => {
    setState(prev => ({
      ...prev,
      isSubmitting: true,
      hasError: false,
      errorMessage: null,
    }))

    try {
      // Step 1: Upload audio file to assets
      const formData = new FormData()
      formData.append('file', audioBlob, 'recording.webm')

      const uploadRes = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        throw new Error('Failed to upload audio')
      }

      const uploadData = await uploadRes.json()
      const assetId = uploadData.data.id

      // Step 2: Create story with audio asset
      const storyTitle = title || `Audio Recording ${new Date().toLocaleDateString()}`
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: storyTitle,
          content: `Audio recording (${Math.round(duration)} seconds)`,
          storyType: 'AUDIO_RECORDING',
          assetIds: [assetId],
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create story')
      }

      // Refresh the stories list
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        formTitle: '',
        formContent: '',
      }))
      await fetchStories()
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        hasError: true,
        errorMessage: error.message || 'Failed to submit audio. Please try again.',
      }))
    }
  }, [fetchStories])

  const clearForm = useCallback(() => {
    setState(prev => ({
      ...prev,
      formTitle: '',
      formContent: '',
      formType: 'text',
      hasError: false,
      errorMessage: null,
    }))
  }, [])

  return {
    ...state,
    setFormTitle,
    setFormContent,
    setFormType,
    submitStory,
    submitAudioStory,
    refreshStories,
    clearForm,
  }
}
