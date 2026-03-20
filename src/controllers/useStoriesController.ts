import { useState, useCallback } from 'react'
import { StoryContribution } from '@/types'
import { mockStories } from '@/data/mockData'

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
  submitStory: () => Promise<void>
  refreshStories: () => Promise<void>
  clearForm: () => void
}

export function useStoriesController(): StoriesControllerState & StoriesControllerActions {
  const [state, setState] = useState<StoriesControllerState>({
    stories: mockStories,
    isSubmitting: false,
    isLoading: false,
    hasError: false,
    errorMessage: null,
    formTitle: '',
    formContent: '',
    formType: 'text',
  })

  const setFormTitle = useCallback((title: string) => {
    setState(prev => ({ ...prev, formTitle: title }))
  }, [])

  const setFormContent = useCallback((content: string) => {
    setState(prev => ({ ...prev, formContent: content }))
  }, [])

  const setFormType = useCallback((type: 'text' | 'audio') => {
    setState(prev => ({ ...prev, formType: type }))
  }, [])

  const submitStory = useCallback(async () => {
    if (!state.formTitle.trim() || !state.formContent.trim()) {
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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const newStory: StoryContribution = {
        id: Date.now().toString(),
        authorName: 'Current User',
        authorRole: 'Family',
        authorAvatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDH2xbiZgnTviGNG0o_IqBprEq0awrhqnK6OmbTFPtC5cqdN9hgINjnLqSlfKT2WROfSvN86O2yQfCrLuDonCZhKfi5sxptEtlsACdfcv6VlHLDLEPGrmnyzu13gNZ5NiZvRcTiwlhX2kqK6kNXy-C-Gy3qZto5zE4ZvR5mmg63iV54ZW2Eg-K9ygXtvUBjWTIghyrqWK6VX_iW79dEbGfE-qLYzCmLjggnNLzfIl0hXL8Lul5xSAg4p3um4MvF3oisaolqDiC_fVs',
        content: state.formContent,
        createdAt: new Date(),
        type: state.formType,
        audioDurationSeconds: state.formType === 'audio' ? 120 : undefined,
      }

      // Optimistic UI: add story immediately
      setState(prev => ({
        ...prev,
        stories: [newStory, ...prev.stories],
        isSubmitting: false,
        formTitle: '',
        formContent: '',
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        hasError: true,
        errorMessage: 'Failed to submit story. Please try again.',
      }))
    }
  }, [state.formTitle, state.formContent, state.formType])

  const refreshStories = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, hasError: false, errorMessage: null }))
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setState(prev => ({
        ...prev,
        stories: mockStories, // In real app, this would be fresh data
        isLoading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage: 'Failed to refresh stories',
      }))
    }
  }, [])

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
    refreshStories,
    clearForm,
  }
}
