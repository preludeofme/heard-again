import { useState, useCallback } from 'react'
import { MemoryWallItem } from '@/types'
import { mockMemoryWall } from '@/data/mockData'

interface DashboardControllerState {
  memoryWall: MemoryWallItem[]
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
    memoryWall: mockMemoryWall,
    selectedMemory: null,
    isLoading: false,
    hasError: false,
    errorMessage: null,
  })

  const selectMemory = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      selectedMemory: prev.selectedMemory === id ? null : id,
    }))
  }, [])

  const playAudioMemory = useCallback((id: string) => {
    const memory = state.memoryWall.find(item => item.id === id)
    if (memory?.type === 'audio-memory') {
      // In a real app, this would trigger audio playback
      console.log('Playing audio memory:', memory.title)
    }
  }, [state.memoryWall])

  const shareMemory = useCallback((id: string) => {
    const memory = state.memoryWall.find(item => item.id === id)
    if (memory) {
      // In a real app, this would open a share dialog
      console.log('Sharing memory:', memory.content || memory.title)
    }
  }, [state.memoryWall])

  const refreshMemoryWall = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, hasError: false, errorMessage: null }))
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setState(prev => ({
        ...prev,
        memoryWall: mockMemoryWall, // In real app, this would be fresh data
        isLoading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage: 'Failed to refresh memory wall',
      }))
    }
  }, [])

  return {
    ...state,
    selectMemory,
    playAudioMemory,
    shareMemory,
    refreshMemoryWall,
  }
}
