/**
 * useVoiceProfiles Hook
 * Finding 5.4: Split useVoiceLabController - Focused hook for voice profile CRUD
 * Responsibility: Fetch, cache, and manage voice profiles list
 */

import { useState, useCallback, useEffect } from 'react'
import type { VoiceModel } from '@/types'
import { toVoiceModelArray } from '@/mappers'
import { useToast } from '@/components/feedback/ToastProvider'

interface VoiceProfilesState {
  voiceModels: VoiceModel[]
  isLoading: boolean
  hasError: boolean
  errorMessage: string | null
}

interface VoiceProfilesActions {
  refreshProfiles: () => Promise<void>
  loadVoiceModels: () => Promise<void>
  deleteVoiceProfile: (profileId: string) => Promise<void>
}

export function useVoiceProfiles(subjectId?: string): VoiceProfilesState & VoiceProfilesActions {
  const [state, setState] = useState<VoiceProfilesState>({
    voiceModels: [],
    isLoading: true,
    hasError: false,
    errorMessage: null,
  })

  const { showSuccess, showError } = useToast()

  const refreshProfiles = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, hasError: false, errorMessage: null }))

    try {
      const url = subjectId ? `/api/voice/profiles?personId=${encodeURIComponent(subjectId)}` : '/api/voice/profiles'
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch profiles')

      const data = await response.json()
      const profiles = data.success ? (data.data || []) : []

      setState(prev => ({
        ...prev,
        voiceModels: toVoiceModelArray(profiles),
        isLoading: false,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load voice profiles'
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage: message,
      }))
    }
  }, [subjectId])

  // Alias for semantic clarity
  const loadVoiceModels = useCallback(async () => {
    await refreshProfiles()
  }, [refreshProfiles])

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
      const message = error instanceof Error ? error.message : 'Failed to delete voice profile'
      console.error('Failed to delete voice profile:', error)
      showError(message)
      throw error
    }
  }, [showSuccess, showError])

  // Load profiles on mount
  useEffect(() => {
    refreshProfiles()
  }, [refreshProfiles])

  return {
    ...state,
    refreshProfiles,
    loadVoiceModels,
    deleteVoiceProfile,
  }
}
