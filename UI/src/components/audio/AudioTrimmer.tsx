import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  Alert,
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  CircularProgress,
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  ContentCut as TrimIcon,
  Replay as ResetIcon,
} from '@mui/icons-material'
import Peaks, { PeaksInstance } from 'peaks.js'

const MIN_SELECTION_SEC = 10
const MAX_SELECTION_SEC = 30
const RECOMMENDED_SEC = 15

interface AudioTrimmerProps {
  /** The raw File the user picked — can be any size */
  file: File
  /** Called with a trimmed File (WAV) ready for upload */
  onTrimComplete: (trimmedFile: File) => void
  /** True while the parent is uploading the trimmed clip */
  disabled?: boolean
}

export function AudioTrimmer({ file, onTrimComplete, disabled }: AudioTrimmerProps) {
  const overviewRef = useRef<HTMLDivElement>(null)
  const zoomviewRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const peaksRef = useRef<PeaksInstance | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)

  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [region, setRegion] = useState<[number, number]>([0, RECOMMENDED_SEC])
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const regionLen = region[1] - region[0]

  // ── Initialize Peaks.js ──
  useEffect(() => {
    if (!overviewRef.current || !zoomviewRef.current || !audioRef.current) return

    let peaksInstance: PeaksInstance | null = null
    let isDestroyed = false
    const audioUrl = URL.createObjectURL(file)
    audioRef.current.src = audioUrl

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()

    // 1. Decode via Web Audio API for high-precision trimming
    const reader = new FileReader()
    reader.onload = async () => {
      if (isDestroyed) return
      try {
        const arrayBuffer = reader.result as ArrayBuffer
        const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0))
        audioBufferRef.current = decoded
      } catch (err) {
        console.error('AudioContext decode error:', err)
      }
    }
    reader.readAsArrayBuffer(file)

    // 2. Init Peaks with visibility polling and metadata check
    const initPeaks = () => {
      if (isDestroyed || !overviewRef.current || !zoomviewRef.current || !audioRef.current) return

      // Peaks.js requires non-zero dimensions
      if (zoomviewRef.current.clientWidth === 0 || zoomviewRef.current.clientHeight === 0) {
        requestAnimationFrame(initPeaks)
        return
      }

      // Ensure metadata is loaded so duration is known
      if (audioRef.current.readyState < 1) { // HAVE_METADATA = 1
        audioRef.current.onloadedmetadata = initPeaks
        return
      }

      const options = {
        overview: {
          container: overviewRef.current,
          waveformColor: '#adcae6',
          playedWaveformColor: '#16334a',
          highlightColor: '#16334a',
        },
        zoomview: {
          container: zoomviewRef.current,
          waveformColor: '#adcae6',
          playedWaveformColor: '#16334a',
        },
        mediaElement: audioRef.current,
        webAudio: {
          audioContext: audioCtx,
        },
      }

      Peaks.init(options, (err, peaks) => {
        if (isDestroyed) {
          peaks?.destroy()
          return
        }
        if (err) {
          const mediaError = audioRef.current?.error
          const errorMsg = mediaError 
            ? `Media Error ${mediaError.code}: ${mediaError.message || 'Unknown source error'}`
            : (err instanceof Error ? err.message : String(err))
          
          console.error('Peaks init error:', errorMsg)
          setError(`Audio Error: ${errorMsg}`)
          return
        }
        if (!peaks) return

        peaksInstance = peaks
        peaksRef.current = peaks

        const dur = peaks.player.getDuration()
        setDuration(dur)

        // Add the initial selection segment
        const end = Math.min(dur, RECOMMENDED_SEC)
        peaks.segments.add({
          startTime: 0,
          endTime: end,
          labelText: 'Selection',
          editable: true,
          color: '#16334a',
          id: 'selection-clip',
        })

        setRegion([0, end])
        setIsReady(true)

        // Listen for segment changes
        const updateRegion = (segment: any) => {
          if (segment.id === 'selection-clip') {
            setRegion([segment.startTime, segment.endTime])
          }
        }

        peaks.on('segments.dragged', updateRegion)
        peaks.on('segments.update', updateRegion)

        peaks.on('player.play', () => setIsPlaying(true))
        peaks.on('player.pause', () => setIsPlaying(false))
      })
    }

    // Small timeout to allow MUI Dialog transitions/layout to settle
    const timer = setTimeout(initPeaks, 50)

    return () => {
      isDestroyed = true
      clearTimeout(timer)
      if (peaksInstance) {
        peaksInstance.destroy()
      }
      if (audioCtx.state !== 'closed') {
        audioCtx.close()
      }
      URL.revokeObjectURL(audioUrl)
    }
  }, [file])

  const handlePlayPause = useCallback(() => {
    if (!peaksRef.current) return
    if (isPlaying) {
      peaksRef.current.player.pause()
    } else {
      peaksRef.current.player.play()
    }
  }, [isPlaying])

  const handleReset = () => {
    if (!peaksRef.current) return
    const segment = peaksRef.current.segments.getSegment('selection-clip')
    if (segment) {
      const end = Math.min(duration, RECOMMENDED_SEC)
      segment.update({ startTime: 0, endTime: end })
      setRegion([0, end])
    }
  }

  const handleConfirmTrim = useCallback(async () => {
    const buf = audioBufferRef.current
    if (!buf) {
      onTrimComplete(file)
      return
    }

    const sampleRate = buf.sampleRate
    const startSample = Math.floor(region[0] * sampleRate)
    const endSample = Math.floor(region[1] * sampleRate)
    const numSamples = endSample - startSample
    const numChannels = buf.numberOfChannels

    const offlineCtx = new OfflineAudioContext(numChannels, numSamples, sampleRate)
    const source = offlineCtx.createBufferSource()
    const trimmedBuffer = offlineCtx.createBuffer(numChannels, numSamples, sampleRate)

    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = buf.getChannelData(ch)
      const trimmedData = trimmedBuffer.getChannelData(ch)
      for (let i = 0; i < numSamples; i++) {
        trimmedData[i] = channelData[startSample + i] || 0
      }
    }

    source.buffer = trimmedBuffer
    source.connect(offlineCtx.destination)
    source.start()

    const rendered = await offlineCtx.startRendering()
    const wavBlob = audioBufferToWav(rendered)
    const baseName = file.name.replace(/\.[^.]+$/, '')
    const trimmedFile = new File([wavBlob], `${baseName}_trimmed.wav`, { type: 'audio/wav' })

    onTrimComplete(trimmedFile)
  }, [region, file, onTrimComplete])

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const needsTrim = duration > MAX_SELECTION_SEC

  return (
    <Box sx={{ mt: 2 }}>
      {/* Hidden Audio Element */}
      <audio ref={audioRef} style={{ display: 'none' }} />

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle2" sx={{ color: '#16334a', fontWeight: 600 }}>
            Select a clip
          </Typography>
          <Chip
            label={`${formatTime(regionLen)} selected`}
            size="small"
            sx={{
              backgroundColor: regionLen >= MIN_SELECTION_SEC && regionLen <= MAX_SELECTION_SEC ? '#d0e3e6' : '#fef6f6',
              color: regionLen >= MIN_SELECTION_SEC && regionLen <= MAX_SELECTION_SEC ? '#16334a' : '#dc2626',
              fontWeight: 600,
              fontSize: '0.7rem',
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={handlePlayPause}
            disabled={!isReady || disabled}
            sx={{ color: '#16334a' }}
          >
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayIcon fontSize="small" />}
          </IconButton>
          <IconButton
            size="small"
            onClick={handleReset}
            disabled={!isReady || disabled}
            sx={{ color: '#546669' }}
            title="Reset"
          >
            <ResetIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Waveform Containers */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* Zoom View */}
        <Box
          sx={{
            height: 120,
            backgroundColor: '#ffffff',
            borderRadius: 2,
            border: '1px solid #d0e3e6',
            overflow: 'hidden',
            position: 'relative',
            display: isReady ? 'block' : 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!isReady && !error && <CircularProgress size={24} sx={{ color: '#16334a' }} />}
          {error && <Typography variant="caption" color="error">{error}</Typography>}
          <div ref={zoomviewRef} style={{ height: '100%', width: '100%' }} />
        </Box>

        {/* Overview */}
        <Box
          sx={{
            height: 48,
            backgroundColor: '#ffffff',
            borderRadius: 1.5,
            border: '1px solid #d0e3e6',
            overflow: 'hidden',
            opacity: isReady ? 1 : 0.5,
          }}
        >
          <div ref={overviewRef} style={{ height: '100%', width: '100%' }} />
        </Box>
      </Box>

      {/* Helper text */}
      <Typography variant="caption" sx={{ color: '#546669', display: 'block', mt: 1.5, textAlign: 'center', px: 2 }}>
        {needsTrim
          ? 'Drag the blue handles in the top view to select 10–30s of clear audio. The bottom bar shows the full recording.'
          : `Audio is ${formatTime(duration)} — you can use it as-is or drag the handles to select a specific part.`}
      </Typography>

      {/* Confirm button */}
      <Button
        variant="contained"
        fullWidth
        startIcon={<TrimIcon />}
        onClick={handleConfirmTrim}
        disabled={!isReady || disabled || (regionLen < MIN_SELECTION_SEC) || (regionLen > MAX_SELECTION_SEC)}
        sx={{
          mt: 2.5,
          background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
          py: 1.5,
          fontWeight: 600,
          textTransform: 'none',
          borderRadius: 2,
        }}
      >
        {needsTrim ? 'Use Selected Clip' : 'Use This Audio'}
      </Button>
    </Box>
  )
}

// ── WAV encoder (PCM 16-bit) ──

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const numSamples = buffer.length
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const dataSize = numSamples * blockAlign
  const headerSize = 44
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(arrayBuffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = buffer.getChannelData(ch)[i]
      const clamped = Math.max(-1, Math.min(1, sample))
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
