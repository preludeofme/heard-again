import { useState, useCallback, useEffect } from 'react'
import { MemoryWallItem } from '@/types'

interface DashboardStats {
  people: number
  stories: number
  voiceProfiles: number
  publishedStories: number
  draftStories: number
}

interface FamilyMember {
  id: string
  name: string
  storyCount: number
  voiceProfileCount: number
  isDeceased: boolean
}

interface DashboardControllerState {
  memoryWall: MemoryWallItem[]
  stats: DashboardStats
  familyMembers: FamilyMember[]
  selectedMemory: string | null
  isLoading: boolean
  hasError: boolean
  errorMessage: string | null
}

interface DashboardControllerActions {
  selectMemory: (id: string) => void
  playAudioMemory: (id: string) => void
  shareMemory: (id: string) => void
  refreshMemoryWall: () => Promise<void>
}

export function useDashboardController(): DashboardControllerState & DashboardControllerActions {
  const [state, setState] = useState<DashboardControllerState>({
    memoryWall: [],
    stats: { people: 0, stories: 0, voiceProfiles: 0, publishedStories: 0, draftStories: 0 },
    familyMembers: [],
    selectedMemory: null,
    isLoading: true,
    hasError: false,
    errorMessage: null,
  })

  const fetchDashboard = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, hasError: false, errorMessage: null }))

    try {
      const response = await fetch('/api/dashboard/stats')
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load dashboard')
      }

      setState(prev => ({
        ...prev,
        memoryWall: data.data.memoryWall || [],
        stats: data.data.stats || prev.stats,
        familyMembers: data.data.familyMembers || [],
        isLoading: false,
      }))
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage: error.message || 'Failed to load dashboard',
      }))
    }
  }, [])

  // Load on mount
  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const selectMemory = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      selectedMemory: prev.selectedMemory === id ? null : id,
    }))
  }, [])

  const playAudioMemory = useCallback((id: string) => {
    const memory = state.memoryWall.find(item => item.id === id)
    if (memory?.type === 'audio-memory') {
      console.log('Playing audio memory:', memory.title)
    }
  }, [state.memoryWall])

  const shareMemory = useCallback((id: string) => {
    const memory = state.memoryWall.find(item => item.id === id)
    if (memory) {
      console.log('Sharing memory:', memory.content || memory.title)
    }
  }, [state.memoryWall])

  const refreshMemoryWall = useCallback(async () => {
    await fetchDashboard()
  }, [fetchDashboard])

  return {
    ...state,
    selectMemory,
    playAudioMemory,
    shareMemory,
    refreshMemoryWall,
  }
}
