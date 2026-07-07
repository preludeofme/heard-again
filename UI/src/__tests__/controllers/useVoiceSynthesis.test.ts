import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from '@jest/globals'
import { useVoiceSynthesis } from '@/controllers/useVoiceSynthesis'

// Mock the dependencies  
vi.mock('@/hooks/useCSRF', () => ({
  useCSRF: vi.fn(),
}))

describe('useVoiceSynthesis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('should initialize correctly', () => {
    const { result } = renderHook(() => useVoiceSynthesis())
    
    expect(result.current.isSynthesizing).toBe(false)
    expect(result.current.synthesisCache).toEqual({})
  })

  it('should get cached audio from cache', () => {
    const mockCache = {
      'model-1:hello wor': {
        audioUrl: 'http://localhost/audio.mp3',
        modelId: 'model-1',
        text: 'hello world',
        createdAt: new Date(),
        duration: 2.5,
      }
    }
    
    const { result } = renderHook(() => useVoiceSynthesis())
    
    // Set up the cache state
    act(() => {
      result.current['synthesisCache'] = mockCache
    })
    
    // Test that cached audio is returned
    const cachedAudio = result.current.getCachedAudio('model-1', 'hello world')
    expect(cachedAudio).toBe('http://localhost/audio.mp3')
  })

  it('should handle cache expiration properly', () => {
    const oldDate = new Date()
    oldDate.setHours(oldDate.getHours() - 2) // 2 hours ago (should be expired)
    
    const mockCache = {
      'model-1:hello wor': {
        audioUrl: 'http://localhost/audio.mp3',
        modelId: 'model-1',
        text: 'hello world',
        createdAt: oldDate, // Old date (should be expired)
        duration: 2.5,
      }
    }
    
    const { result } = renderHook(() => useVoiceSynthesis())
    
    // Set up the cache state
    act(() => {
      result.current['synthesisCache'] = mockCache
    })
    
    // Test that expired cached audio is not returned
    const cachedAudio = result.current.getCachedAudio('model-1', 'hello world')
    expect(cachedAudio).toBeUndefined()
  })
})