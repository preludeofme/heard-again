// Test file for useVoiceProfiles controller in Heard Again project
import { renderHook, waitFor } from '@testing-library/react'
import { useVoiceProfiles } from '@/controllers/useVoiceProfiles'

describe('useVoiceProfiles Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize with correct initial state before the fetch resolves', () => {
    // Never-resolving fetch keeps the hook in its initial loading state so we
    // can assert on it synchronously, before the effect's promise settles.
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch

    const { result } = renderHook(() => useVoiceProfiles())

    expect(result.current.voiceModels).toEqual([])
    expect(result.current.isLoading).toBe(true)
    expect(result.current.hasError).toBe(false)
    expect(result.current.errorMessage).toBeNull()
  })

  it('should handle successful data fetch', async () => {
    const mockProfiles = [
      { id: 'profile-1', name: 'Voice 1', language: 'en', createdAt: '2024-01-01T00:00:00.000Z' },
      { id: 'profile-2', name: 'Voice 2', language: 'en', createdAt: '2024-01-02T00:00:00.000Z' },
    ]

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, data: mockProfiles }),
    }) as unknown as typeof fetch

    const { result } = renderHook(() => useVoiceProfiles())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.hasError).toBe(false)
    expect(result.current.voiceModels).toHaveLength(2)
    expect(result.current.voiceModels.map(m => m.id)).toEqual(['profile-1', 'profile-2'])
  })

  it('should handle error case', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('API Error')) as unknown as typeof fetch

    const { result } = renderHook(() => useVoiceProfiles())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.hasError).toBe(true)
    expect(result.current.errorMessage).toEqual('API Error')
  })
})
