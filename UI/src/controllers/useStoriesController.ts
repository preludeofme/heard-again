import { useState, useCallback, useEffect } from 'react'
import { StoryContribution } from '@/types'
import { ApiError, handleApiResponse } from '@/lib/errors'

interface StoriesControllerState {
  stories: StoryContribution[]
  isSubmitting: boolean
  isLoading: boolean
  hasError: boolean
  errorMessage: string | null
}

interface CreateStoryInput {
  title: string
  content: string
  storyType: 'MEMORY' | 'AUDIO_RECORDING'
  subjectId?: string
}

interface StoriesControllerActions {
  submitStory: (input: CreateStoryInput) => Promise<void>
  submitAudioStory: (audioBlob: Blob, duration: number, title?: string) => Promise<void>
  refreshStories: () => Promise<void>
}

export function useStoriesController(subjectId?: string): StoriesControllerState & StoriesControllerActions {
  const [state, setState] = useState<StoriesControllerState>({
    stories: [],
    isSubmitting: false,
    isLoading: true,
    hasError: false,
    errorMessage: null,
  })

  // Interface for the raw API response (not the view model)
interface StoryApiResponse {
  id: string
  createdBy?: {
    displayName?: string
    email?: string
  }
  excerpt?: string
  title?: string
  createdAt: string
  hasAudio?: boolean
}

function mapStoryToContribution(s: StoryApiResponse): StoryContribution {
  return {
    id: s.id,
    authorName: s.createdBy?.displayName || s.createdBy?.email || 'Unknown',
    authorRole: 'Family',
    authorAvatarUrl: '',
    content: s.excerpt || s.title || '',
    createdAt: new Date(s.createdAt),
    type: s.hasAudio ? 'audio' : 'text',
    audioDurationSeconds: undefined,
  }
}

const fetchStories = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, hasError: false, errorMessage: null }))

    try {
      const query = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : ''
      const response = await fetch(`/api/stories${query}`)

      const data = await handleApiResponse<{ stories: StoryApiResponse[] }>(response)
      const stories = (data?.stories || []).map(mapStoryToContribution)

      setState(prev => ({ ...prev, stories, isLoading: false }))
    } catch (error) {
      const apiError = ApiError.fromError(error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage: apiError.message,
      }))
    }
  }, [subjectId])

  // Load on mount
  useEffect(() => {
    fetchStories()
  }, [fetchStories])

  const submitStory = useCallback(async (input: CreateStoryInput) => {
    if (!input.title.trim() || !input.content.trim()) {
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
      errorMessage: null,
    }))

    try {
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      await handleApiResponse(response)

      // Refresh the stories list to get the new story
      setState(prev => ({
        ...prev,
        isSubmitting: false,
      }))
      await fetchStories()
    } catch (error) {
      const apiError = ApiError.fromError(error)
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        hasError: true,
        errorMessage: apiError.message,
      }))
    }
  }, [fetchStories])

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

      await handleApiResponse(response)

      // Refresh the stories list
      setState(prev => ({
        ...prev,
        isSubmitting: false,
      }))
      await fetchStories()
    } catch (error) {
      const apiError = ApiError.fromError(error)
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        hasError: true,
        errorMessage: apiError.message,
      }))
    }
  }, [fetchStories])

  return {
    ...state,
    submitStory,
    submitAudioStory,
    refreshStories,
  }
}
