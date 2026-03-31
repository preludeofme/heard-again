import { useCallback, useEffect, useRef, useState } from 'react'

interface VoicePlaybackState {
  isPlayingAudio: boolean
  currentAudioUrl: string | null
}

interface VoicePlaybackActions {
  playAudio: (audioUrl: string) => void
  stopAudio: () => void
}

export function useVoicePlayback(
  onError?: (message: string) => void
): VoicePlaybackState & VoicePlaybackActions {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [state, setState] = useState<VoicePlaybackState>({
    isPlayingAudio: false,
    currentAudioUrl: null,
  })

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    setState({
      isPlayingAudio: false,
      currentAudioUrl: null,
    })
  }, [])

  const playAudio = useCallback((audioUrl: string) => {
    if (audioRef.current) {
      audioRef.current.pause()
    }

    const audio = new Audio(audioUrl)
    audioRef.current = audio

    setState({
      isPlayingAudio: true,
      currentAudioUrl: audioUrl,
    })

    audio.onended = () => {
      setState({
        isPlayingAudio: false,
        currentAudioUrl: null,
      })
    }

    audio.onerror = () => {
      setState({
        isPlayingAudio: false,
        currentAudioUrl: null,
      })
      onError?.('Failed to play audio')
    }

    void audio.play()
  }, [onError])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  return {
    ...state,
    playAudio,
    stopAudio,
  }
}
