// Test file for useVoiceProfiles controller in Heard Again project
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from '@jest/globals'
import { useVoiceProfiles } from '@/controllers/useVoiceProfiles'

describe('useVoiceProfiles Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with correct initial state', () => {
    const { result } = renderHook(() => useVoiceProfiles())
    
    // Check initial state properties
    expect(result.current.voiceModels).toEqual([])
    expect(result.current.isLoading).toBe(true)
    expect(result.current.hasError).toBe(false)
    expect(result.current.errorMessage).toBeNull()
  })

  it('should handle successful data fetch', async () => {
    // Mock the fetch API with resolved data
    const mockProfiles = [
      {
        id: 'profile-1',
        name: 'Voice 1',
        language: 'en',
        gender: 'male',
        available: true,
      },
      {
        id: 'profile-2',
        name: 'Voice 2',
        language: 'en',
        gender: 'female',  
        available: true,
      }
    ]

    const mockResponse = {
      success: true,
      data: mockProfiles
    }

    const mockFetch = vi.fn()
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse)
    })
    
    // Replace global fetch with our mock
    global.fetch = mockFetch
    
    // Render the hook and wait for async operation
    const { result } = renderHook(() => useVoiceProfiles())
    
    // Wait for the hook to process the async fetch
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })
    
    // Validate the data was processed correctly
    expect(result.current.voiceModels).toEqual(mockProfiles)
    expect(result.current.isLoading).toBe(false)
  })

  it('should handle error case', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockRejectedValue(new Error('API Error'))
    
    global.fetch = mockFetch
    
    const { result } = renderHook(() => useVoiceProfiles())
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })
    
    expect(result.current.hasError).toBe(true)
    expect(result.current.errorMessage).toEqual('API Error')
    expect(result.current.isLoading).toBe(false)
  })
})