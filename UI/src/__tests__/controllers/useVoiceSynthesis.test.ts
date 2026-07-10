import { renderHook, act } from '@testing-library/react'
import { useVoiceSynthesis } from '@/controllers/useVoiceSynthesis'

// Mock the dependencies
jest.mock('@/hooks/useCSRF', () => ({
  useCSRF: jest.fn(() => ({ fetchToken: jest.fn().mockResolvedValue('mock-csrf-token') })),
}))

describe('useVoiceSynthesis', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize correctly', () => {
    const { result } = renderHook(() => useVoiceSynthesis())

    expect(result.current.isSynthesizing).toBe(false)
    expect(result.current.synthesisCache).toEqual({})
  })

  it('should return cached audio after a successful synthesis', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        data: { audioUrl: 'http://localhost/audio.mp3', duration: 2.5 },
      }),
    }) as unknown as typeof fetch

    const { result } = renderHook(() => useVoiceSynthesis())

    await act(async () => {
      await result.current.synthesizeSpeech('model-1', 'hello world')
    })

    const cachedAudio = result.current.getCachedAudio('model-1', 'hello world')
    expect(cachedAudio).toBe('http://localhost/audio.mp3')
    expect(result.current.isSynthesizing).toBe(false)
  })

  it('should not return cached audio for a synthesis that was never made', () => {
    const { result } = renderHook(() => useVoiceSynthesis())

    const cachedAudio = result.current.getCachedAudio('model-1', 'hello world')
    expect(cachedAudio).toBeUndefined()
  })

  it('clearSynthesisCache empties the cache', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        data: { audioUrl: 'http://localhost/audio.mp3', duration: 2.5 },
      }),
    }) as unknown as typeof fetch

    const { result } = renderHook(() => useVoiceSynthesis())

    await act(async () => {
      await result.current.synthesizeSpeech('model-1', 'hello world')
    })
    expect(result.current.getCachedAudio('model-1', 'hello world')).toBe('http://localhost/audio.mp3')

    act(() => {
      result.current.clearSynthesisCache()
    })

    expect(result.current.synthesisCache).toEqual({})
    expect(result.current.getCachedAudio('model-1', 'hello world')).toBeUndefined()
  })
})
