import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  Box,
  Typography,
  IconButton,
  Button,
  Slider,
  Chip,
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  ContentCut as TrimIcon,
  Replay as ResetIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material'
import WaveSurfer from 'wavesurfer.js'

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

/**
 * Renders a waveform of the uploaded audio and lets the user drag a region
 * to select 10-30 s of audio.  On confirm the selected segment is extracted
 * client-side via Web Audio API and handed back as a WAV File.
 */
export function AudioTrimmer({ file, onTrimComplete, disabled }: AudioTrimmerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)

  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [region, setRegion] = useState<[number, number]>([0, RECOMMENDED_SEC])
  const [isReady, setIsReady] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(0) // 0 = fit-to-width, >0 = px per second

  const regionLen = region[1] - region[0]

  // ── Load the file into WaveSurfer + Web Audio API ──
  useEffect(() => {
    if (!containerRef.current) return

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#adcae6',
      progressColor: '#16334a',
      cursorColor: '#e74c3c',
      cursorWidth: 2,
      height: 96,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      interact: true,
      minPxPerSec: 1,
    })

    wsRef.current = ws

    // Click on waveform → place 15s selection starting there
    ws.on('click', (relativeX: number) => {
      const dur = ws.getDuration()
      const clickTime = relativeX * dur
      const selEnd = Math.min(clickTime + RECOMMENDED_SEC, dur)
      const selStart = Math.max(selEnd - RECOMMENDED_SEC, 0)
      setRegion([selStart, selEnd])
    })

    // Decode via Web Audio API for trimming
    const reader = new FileReader()
    reader.onload = async () => {
      const arrayBuffer = reader.result as ArrayBuffer

      // Decode for trimming
      const audioCtx = new AudioContext()
      const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0))
      audioBufferRef.current = decoded
      audioCtx.close()

      // Load into wavesurfer for visualization
      const blob = new Blob([arrayBuffer], { type: file.type })
      ws.loadBlob(blob)
    }
    reader.readAsArrayBuffer(file)

    ws.on('ready', () => {
      const dur = ws.getDuration()
      setDuration(dur)
      // Default region: first RECOMMENDED_SEC or full duration if shorter
      const end = Math.min(dur, RECOMMENDED_SEC)
      setRegion([0, end])
      setIsReady(true)
      setZoomLevel(0)
    })

    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('finish', () => setIsPlaying(false))

    return () => {
      ws.destroy()
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  // ── Playback: only play the selected region ──
  const handlePlayPause = useCallback(() => {
    const ws = wsRef.current
    if (!ws) return

    if (isPlaying) {
      ws.pause()
    } else {
      // Seek to region start and play
      ws.setTime(region[0])
      ws.play()

      // Stop when we reach region end
      const checkEnd = () => {
        if (ws.getCurrentTime() >= region[1]) {
          ws.pause()
          ws.un('audioprocess', checkEnd)
          ws.un('timeupdate', checkEnd)
        }
      }
      ws.on('timeupdate', checkEnd)
    }
  }, [isPlaying, region])

  // ── Region slider change ──
  const handleRegionChange = (_event: Event, newValue: number | number[]) => {
    if (!Array.isArray(newValue)) return
    let [start, end] = newValue

    // Enforce min/max selection length
    const len = end - start
    if (len < MIN_SELECTION_SEC) {
      // Expand to minimum
      if (end + (MIN_SELECTION_SEC - len) <= duration) {
        end = start + MIN_SELECTION_SEC
      } else {
        start = end - MIN_SELECTION_SEC
      }
    }
    if (len > MAX_SELECTION_SEC) {
      end = start + MAX_SELECTION_SEC
    }

    setRegion([Math.max(0, start), Math.min(duration, end)])
  }

  // ── Reset to full recommended selection ──
  const handleReset = () => {
    setRegion([0, Math.min(duration, RECOMMENDED_SEC)])
    // Also reset zoom
    if (wsRef.current) {
      wsRef.current.zoom(0)
      setZoomLevel(0)
    }
  }

  // ── Zoom controls ──
  const handleZoomIn = useCallback(() => {
    const ws = wsRef.current
    if (!ws || !containerRef.current) return
    const containerWidth = containerRef.current.clientWidth
    // Calculate current px/sec; zoom in by showing fewer seconds
    const currentPxPerSec = zoomLevel || (containerWidth / duration)
    const newPxPerSec = Math.min(currentPxPerSec * 2, 200) // cap at 200px/sec
    ws.zoom(newPxPerSec)
    setZoomLevel(newPxPerSec)
    // Scroll to center the selection
    const scrollContainer = containerRef.current.querySelector('div[data-testid]')?.parentElement
      || containerRef.current.firstElementChild as HTMLElement | null
    if (scrollContainer) {
      const regionCenter = (region[0] + region[1]) / 2
      const scrollPos = (regionCenter / duration) * (newPxPerSec * duration) - containerWidth / 2
      scrollContainer.scrollLeft = Math.max(0, scrollPos)
    }
  }, [zoomLevel, duration, region])

  const handleZoomOut = useCallback(() => {
    const ws = wsRef.current
    if (!ws || !containerRef.current) return
    const containerWidth = containerRef.current.clientWidth
    const minPxPerSec = containerWidth / duration
    const currentPxPerSec = zoomLevel || minPxPerSec
    const newPxPerSec = Math.max(currentPxPerSec / 2, minPxPerSec)
    if (newPxPerSec <= minPxPerSec) {
      ws.zoom(0)
      setZoomLevel(0)
    } else {
      ws.zoom(newPxPerSec)
      setZoomLevel(newPxPerSec)
    }
  }, [zoomLevel, duration])

  // ── Extract selected region as WAV and hand back ──
  const handleConfirmTrim = useCallback(async () => {
    const buf = audioBufferRef.current
    if (!buf) return

    const sampleRate = buf.sampleRate
    const startSample = Math.floor(region[0] * sampleRate)
    const endSample = Math.floor(region[1] * sampleRate)
    const numSamples = endSample - startSample
    const numChannels = buf.numberOfChannels

    // Create an offline context to extract the segment
    const offlineCtx = new OfflineAudioContext(numChannels, numSamples, sampleRate)
    const source = offlineCtx.createBufferSource()

    // Create a new buffer with just the selected region
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

    // Encode to WAV
    const wavBlob = audioBufferToWav(rendered)
    const baseName = file.name.replace(/\.[^.]+$/, '')
    const trimmedFile = new File(
      [wavBlob],
      `${baseName}_trimmed.wav`,
      { type: 'audio/wav' },
    )

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
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle2" sx={{ color: '#16334a', fontWeight: 600 }}>
            Select a clip
          </Typography>
          <Chip
            label={`${formatTime(regionLen)} selected`}
            size="small"
            sx={{
              backgroundColor: regionLen >= MIN_SELECTION_SEC ? '#d0e3e6' : '#fef6f6',
              color: regionLen >= MIN_SELECTION_SEC ? '#16334a' : '#dc2626',
              fontWeight: 600,
              fontSize: '0.7rem',
            }}
          />
          {isReady && (
            <Chip
              label={`${formatTime(region[0])} – ${formatTime(region[1])}`}
              size="small"
              variant="outlined"
              sx={{
                borderColor: '#d0e3e6',
                color: '#546669',
                fontSize: '0.7rem',
              }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={handleZoomOut}
            disabled={!isReady || disabled || zoomLevel === 0}
            sx={{ color: '#546669' }}
            title="Zoom out"
          >
            <ZoomOutIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={handleZoomIn}
            disabled={!isReady || disabled}
            sx={{ color: '#546669' }}
            title="Zoom in"
          >
            <ZoomInIcon fontSize="small" />
          </IconButton>
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

      {/* Waveform */}
      <Box
        sx={{
          position: 'relative',
          backgroundColor: '#ffffff',
          borderRadius: 2,
          border: '1px solid #d0e3e6',
          overflow: 'hidden',
          p: 1,
          cursor: isReady ? 'crosshair' : 'default',
        }}
      >
        <div ref={containerRef} style={{ overflowX: 'auto' }} />

        {/* Region overlay */}
        {isReady && duration > 0 && (
          <>
            {/* Left mask */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${(region[0] / duration) * 100}%`,
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.15)',
                pointerEvents: 'none',
                borderRadius: '8px 0 0 8px',
              }}
            />
            {/* Right mask */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: `${((duration - region[1]) / duration) * 100}%`,
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.15)',
                pointerEvents: 'none',
                borderRadius: '0 8px 8px 0',
              }}
            />
            {/* Left handle */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: `${(region[0] / duration) * 100}%`,
                width: 3,
                height: '100%',
                backgroundColor: '#16334a',
                pointerEvents: 'none',
              }}
            />
            {/* Right handle */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: `${(region[1] / duration) * 100}%`,
                width: 3,
                height: '100%',
                backgroundColor: '#16334a',
                pointerEvents: 'none',
              }}
            />
          </>
        )}
      </Box>

      {/* Range slider */}
      {isReady && (
        <Box sx={{ px: 1, mt: 1 }}>
          <Slider
            value={region}
            onChange={handleRegionChange}
            min={0}
            max={duration}
            step={0.1}
            valueLabelDisplay="auto"
            valueLabelFormat={formatTime}
            disabled={disabled}
            sx={{
              color: '#16334a',
              '& .MuiSlider-thumb': {
                width: 14,
                height: 14,
                '&:hover, &.Mui-focusVisible': {
                  boxShadow: '0 0 0 6px rgba(22, 51, 74, 0.16)',
                },
              },
              '& .MuiSlider-valueLabel': {
                backgroundColor: '#16334a',
                borderRadius: 1,
                fontSize: '0.7rem',
              },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: '#8a9a9d' }}>
              {formatTime(0)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#8a9a9d' }}>
              Total: {formatTime(duration)}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Helper text */}
      <Typography variant="caption" sx={{ color: '#546669', display: 'block', mt: 1, textAlign: 'center' }}>
        {needsTrim
          ? 'Click on the waveform to place a 15s selection, or drag the slider handles. Use zoom for precision.'
          : `Audio is ${formatTime(duration)} — ready to use as-is or adjust the selection`}
      </Typography>

      {/* Confirm button */}
      <Button
        variant="contained"
        fullWidth
        startIcon={<TrimIcon />}
        onClick={handleConfirmTrim}
        disabled={!isReady || disabled || regionLen < MIN_SELECTION_SEC}
        sx={{
          mt: 2,
          background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
          py: 1.25,
          fontWeight: 600,
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

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')

  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // bits per sample

  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Interleave channels and write PCM samples
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
