import { useState, useCallback, useEffect } from 'react'
import { StoryContribution } from '@/types'
import { ApiError, handleApiResponse } from '@/lib/errors'
import { fetchWithCSRF, fetchWithCSRFAndFormData } from '@/lib/api-client'

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
  storyType: 'MEMORY' | 'RECORDING'
  subjectId?: string
  storyDate?: string
  location?: string
  authorRelationship?: string
  isPublic?: boolean
}

interface StoriesControllerActions {
  submitStory: (input: CreateStoryInput) => Promise<void>
  submitAudioStory: (audioBlob: Blob, duration: number, title?: string, relationship?: string) => Promise<void>
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
    avatarUrl?: string | null
  }
  subject?: {
    firstName?: string
    lastName?: string
    avatarUrl?: string | null
  } | null
  excerpt?: string
  title?: string
  content: string
  createdAt: string
  hasAudio?: boolean
  audioUrl?: string
  durationSeconds?: number
  authorRelationship?: string | null
  isPublic?: boolean
  narrationStatus?: string
}

function mapStoryToContribution(s: StoryApiResponse): StoryContribution {
  const creatorName = s.createdBy?.displayName || s.createdBy?.email?.split('@')[0] || 'Unknown'
  return {
    id: s.id,
    authorName: creatorName,
    authorRole: 'Family',
    authorAvatarUrl: s.subject?.avatarUrl || s.createdBy?.avatarUrl || '',
    content: s.content || s.excerpt || s.title || '',
    createdAt: new Date(s.createdAt),
    type: s.hasAudio ? 'audio' : 'text',
    audioUrl: s.audioUrl,
    audioDurationSeconds: s.durationSeconds,
    authorRelationship: s.authorRelationship,
    isPublic: s.isPublic,
    hasNarration: s.narrationStatus === 'APPROVED' || s.narrationStatus === 'READY',
  }
}


const fetchStories = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, hasError: false, errorMessage: null }))

    try {
      const query = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : ''
      const response = await fetch(`/api/stories${query}`, { credentials: 'include' })

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
      const response = await fetchWithCSRF('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
  }, [fetchStories, subjectId])

  const refreshStories = useCallback(async () => {
    await fetchStories()
  }, [fetchStories])

  const submitAudioStory = useCallback(async (audioBlob: Blob, duration: number, title?: string, relationship?: string) => {
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

      const uploadRes = await fetchWithCSRFAndFormData('/api/assets/upload', formData, {
        credentials: 'include',
      })

      if (!uploadRes.ok) {
        throw new Error('Failed to upload audio')
      }

      const uploadData = await uploadRes.json()
      const assetId = uploadData.data.id

      // Step 2: Transcribe audio
      let transcript = ''
      try {
        const transcribeFormData = new FormData()
        transcribeFormData.append('file', audioBlob, 'recording.webm')
        const transcribeRes = await fetchWithCSRFAndFormData('/api/voice/transcribe', transcribeFormData, {
          credentials: 'include',
        })
        if (transcribeRes.ok) {
          const transcribeData = await transcribeRes.json()
          transcript = transcribeData.data?.transcript || ''
        }
      } catch (transcribeErr) {
        console.warn('Transcription failed:', transcribeErr)
        // Non-fatal, we continue with just the recording
      }

      // Step 3: Create story with audio asset and transcript
      const storyTitle = title || `Audio Recording ${new Date().toLocaleDateString()}`
      const response = await fetchWithCSRF('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: storyTitle,
          content: transcript || `Audio recording (${Math.round(duration)} seconds)`,
          storyType: 'RECORDING',
          subjectId,
          assetIds: [assetId],
          authorRelationship: relationship,
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
  }, [fetchStories, subjectId])

  return {
    ...state,
    submitStory,
    submitAudioStory,
    refreshStories,
  }
}
