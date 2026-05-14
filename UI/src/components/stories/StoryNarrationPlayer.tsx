
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
  Alert,
  LinearProgress,
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Download as DownloadIcon,
  SmartToy as AiIcon,
  ErrorOutline as ErrorIcon,
  Delete as DeleteIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material'
import { fetchWithCSRF } from '@/lib/api-client'

interface VoiceProfileOption {
  id: string
  name: string
  personId?: string | null
  personName?: string | null
}

export interface SavedNarration {
  assetId: string
  downloadUrl: string
  voiceProfileId: string
}

interface NarrationJobStatus {
  status: 'queued' | 'processing' | 'synthesizing' | 'saving' | 'completed' | 'failed'
  sentencesDone: number
  sentencesTotal: number
  assetId: string | null
  assetDownloadUrl: string | null
  errorMessage: string | null
}

interface StoryNarrationPlayerProps {
  storyId: string
  title?: string
  narrationSource: 'approved' | 'original'
  voiceProfiles: VoiceProfileOption[]
  defaultVoiceProfileId?: string | null
  savedNarration?: SavedNarration | null
  activeJobId?: string | null
  onSaved?: (narration: SavedNarration) => void
}

type PlayerState = 'idle' | 'checking' | 'rendering' | 'ready' | 'error'

const POLL_INTERVAL_MS = 2000

interface NarrateApiResponse {
  success: boolean
  status?: 'ready' | 'queued'
  assetId?: string
  assetDownloadUrl?: string
  voiceProfileId?: string
  narrationJobId?: string
  queueJobId?: string
  error?: string
}

interface NarrationJobApiResponse extends NarrationJobStatus {
  success: boolean
  jobId: string
  error?: string
}

export function StoryNarrationPlayer({
  storyId,
  title,
  narrationSource,
  voiceProfiles,
  defaultVoiceProfileId,
  savedNarration,
  activeJobId,
  onSaved,
}: StoryNarrationPlayerProps) {
  const initialProfileId = defaultVoiceProfileId || savedNarration?.voiceProfileId || voiceProfiles[0]?.id || ''
  const [selectedProfileId, setSelectedProfileId] = useState<string>(initialProfileId)
  const [state, setState] = useState<PlayerState>(() => {
    if (savedNarration && savedNarration.voiceProfileId === initialProfileId) return 'ready'
    if (activeJobId) return 'rendering'
    return 'idle'
  })
  const [jobId, setJobId] = useState<string | null>(activeJobId ?? null)
  const [jobStatus, setJobStatus] = useState<NarrationJobStatus | null>(null)
  const [readyNarration, setReadyNarration] = useState<SavedNarration | null>(
    savedNarration && savedNarration.voiceProfileId === initialProfileId ? savedNarration : null,
  )
  const [error, setError] = useState<string | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  const pollJobStatus = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/narration-jobs/${id}`, {
          headers: { Accept: 'application/json' },
          credentials: 'include',
        })
        const payload = (await res.json()) as NarrationJobApiResponse
        if (!res.ok || !payload.success) {
          throw new Error(payload.error || 'Failed to poll job status')
        }
        setJobStatus(payload)

        if (payload.status === 'completed' && payload.assetId && payload.assetDownloadUrl) {
          stopPolling()
          const next: SavedNarration = {
            assetId: payload.assetId,
            downloadUrl: payload.assetDownloadUrl,
            voiceProfileId: selectedProfileId,
          }
          setReadyNarration(next)
          setJobId(null)
          setState('ready')
          onSaved?.(next)
        } else if (payload.status === 'failed' || (payload.errorMessage && payload.status !== 'completed')) {
          // Check errorMessage regardless of status — when a job is retried by BullMQ,
          // the previous attempt's errorMessage can be set while status still shows synthesizing.
          stopPolling()
          setState('error')
          setError(payload.errorMessage || 'Synthesis failed')
        }
      } catch (err) {
        // Transient network errors: keep polling. The job persists in BullMQ regardless.
        console.warn('[StoryNarrationPlayer] poll failed', err)
      }
    },
    [onSaved, selectedProfileId, stopPolling],
  )

  useEffect(() => {
    if (state !== 'rendering' || !jobId) return undefined
    void pollJobStatus(jobId)
    pollIntervalRef.current = setInterval(() => {
      void pollJobStatus(jobId)
    }, POLL_INTERVAL_MS)
    return stopPolling
  }, [state, jobId, pollJobStatus, stopPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

  const startNarration = useCallback(
    async (profileId: string) => {
      if (!profileId) {
        setError('Please select a voice profile first.')
        setState('error')
        return
      }
      setError(null)
      setState('checking')
      stopPolling()
      try {
        const res = await fetch(
          `/api/stories/${storyId}/narrate?voiceProfileId=${encodeURIComponent(profileId)}`,
          {
            headers: { Accept: 'application/json' },
            credentials: 'include',
          },
        )
        const payload = (await res.json()) as NarrateApiResponse

        if (!res.ok || !payload.success) {
          throw new Error(payload.error || `Failed to start narration (${res.status})`)
        }

        if (payload.status === 'ready' && payload.assetId && payload.assetDownloadUrl) {
          const next: SavedNarration = {
            assetId: payload.assetId,
            downloadUrl: payload.assetDownloadUrl,
            voiceProfileId: payload.voiceProfileId || profileId,
          }
          setReadyNarration(next)
          setJobId(null)
          setJobStatus(null)
          setState('ready')
          onSaved?.(next)
          return
        }

        if (payload.status === 'queued' && payload.narrationJobId) {
          setJobId(payload.narrationJobId)
          setJobStatus(null)
          setState('rendering')
          return
        }

        throw new Error('Unexpected response from narration endpoint')
      } catch (err) {
        setState('error')
        setError(err instanceof Error ? err.message : 'Failed to start narration')
      }
    },
    [onSaved, storyId, stopPolling],
  )

  // When parent prop changes (e.g. fetchStory after polling completes), keep state in sync
  useEffect(() => {
    if (!savedNarration) return
    if (savedNarration.voiceProfileId !== selectedProfileId) return
    setReadyNarration(savedNarration)
    setState((prev) => (prev === 'rendering' ? 'rendering' : 'ready'))
  }, [savedNarration, selectedProfileId])

  const handleVoiceChange = useCallback(
    (nextProfileId: string) => {
      if (nextProfileId === selectedProfileId) return
      setSelectedProfileId(nextProfileId)
      stopPolling()
      setJobId(null)
      setJobStatus(null)
      setError(null)

      // Cache hit for the previously-saved voice? Show ready immediately if it matches.
      if (savedNarration && savedNarration.voiceProfileId === nextProfileId) {
        setReadyNarration(savedNarration)
        setState('ready')
        return
      }

      setReadyNarration(null)
      // Auto-check the cache + enqueue if needed for the new voice (plan §9: voice change → rendering).
      void startNarration(nextProfileId)
    },
    [savedNarration, selectedProfileId, startNarration, stopPolling],
  )

  const handlePlayClick = useCallback(() => {
    void startNarration(selectedProfileId)
  }, [selectedProfileId, startNarration])

  const handleDelete = useCallback(async () => {
    if (!confirm('Are you sure you want to delete this AI narration? This will remove the audio files for all voice versions of this story.')) {
      return
    }
    
    try {
      const res = await fetchWithCSRF(`/api/stories/${storyId}/narration`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setReadyNarration(null)
        setJobId(null)
        setJobStatus(null)
        setState('idle')
      } else {
        const payload = await res.json()
        alert(`Failed to delete: ${payload.error || 'Unknown error'}`)
      }
    } catch (err) {
      console.error('Failed to delete narration:', err)
      alert('Failed to delete narration')
    }
  }, [storyId])

  const handleCancel = useCallback(async () => {
    if (!jobId) return
    stopPolling()
    try {
      await fetchWithCSRF(`/api/narration-jobs/${jobId}`, { method: 'DELETE', credentials: 'include' })
    } catch {
      // Best-effort — state resets regardless
    }
    setJobId(null)
    setJobStatus(null)
    setState(readyNarration ? 'ready' : 'idle')
  }, [jobId, readyNarration, stopPolling])

  const renderProgress = () => {
    if (state !== 'rendering') return null
    const total = jobStatus?.sentencesTotal ?? 0
    const done = jobStatus?.sentencesDone ?? 0
    const percent = total > 0 ? (done / total) * 100 : 0
    const label = (() => {
      if (!jobStatus || jobStatus.status === 'queued') return 'Queued…'
      if (jobStatus.status === 'synthesizing') return `Synthesizing sentences… (${done}/${total})`
      if (jobStatus.status === 'saving') return 'Finishing up…'
      return 'Preparing narration…'
    })()
    return (
      <Box sx={{ mt: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#546669' }}>
            {label}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#16334a' }}>
              {Math.round(percent)}%
            </Typography>
            <Button
              size="small"
              variant="text"
              startIcon={<CancelIcon sx={{ fontSize: 14 }} />}
              onClick={handleCancel}
              sx={{ textTransform: 'none', color: '#546669', fontWeight: 500, minWidth: 0, px: 1, py: 0.25 }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
        <LinearProgress
          variant={total > 0 ? 'determinate' : 'indeterminate'}
          value={percent}
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: '#d0e3e6',
            '& .MuiLinearProgress-bar': { backgroundColor: '#16334a' },
          }}
        />
      </Box>
    )
  }

  return (
    <Box
      sx={{
        backgroundColor: '#f6f3ee',
        border: '1px solid #ebe8e3',
        borderRadius: 3,
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#16334a' }}>
          {title ? `Listen to "${title}"` : 'Listen'}
        </Typography>
        <Chip
          icon={<AiIcon sx={{ fontSize: 14 }} />}
          label={`AI-generated (${narrationSource})`}
          size="small"
          sx={{ backgroundColor: '#d0e3e6', color: '#16334a', fontWeight: 500 }}
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 200, maxWidth: 360 }}>
          <InputLabel id="voice-profile-select-label">Voice</InputLabel>
          <Select
            labelId="voice-profile-select-label"
            label="Voice"
            value={voiceProfiles.some((vp) => vp.id === selectedProfileId) ? selectedProfileId : ''}
            onChange={(e) => handleVoiceChange(e.target.value as string)}
            disabled={voiceProfiles.length === 0 || state === 'rendering' || state === 'checking'}
          >
            {voiceProfiles.length === 0 ? (
              <MenuItem value="" disabled>
                No ready voice profiles
              </MenuItem>
            ) : (
              voiceProfiles.map((vp) => (
                <MenuItem key={vp.id} value={vp.id}>
                  {vp.personName ? `${vp.personName} — ${vp.name}` : vp.name}
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>

        {state === 'idle' && (
          <Button
            variant="contained"
            startIcon={<PlayIcon />}
            onClick={handlePlayClick}
            disabled={!selectedProfileId}
            sx={{
              backgroundColor: '#16334a',
              color: 'white',
              '&:hover': { backgroundColor: '#2e4a62' },
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 2,
              height: 40,
            }}
          >
            Prepare & Play
          </Button>
        )}

        {state === 'checking' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: 40 }}>
            <CircularProgress size={20} sx={{ color: '#16334a' }} />
            <Typography variant="body2" sx={{ color: '#546669' }}>
              Checking cache…
            </Typography>
          </Box>
        )}
      </Box>

      {state === 'rendering' && renderProgress()}

      {state === 'ready' && readyNarration && (
        <Box sx={{ mt: 1 }}>
          <audio
            controls
            preload="metadata"
            src={readyNarration.downloadUrl}
            style={{ width: '100%', height: 40 }}
            data-testid="narration-audio"
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, gap: 1 }}>
            <Button
              onClick={handleDelete}
              startIcon={<DeleteIcon />}
              size="small"
              color="error"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Delete
            </Button>
            <Button
              component="a"
              href={readyNarration.downloadUrl}
              download={`${title || 'narration'}`}
              startIcon={<DownloadIcon />}
              size="small"
              sx={{ textTransform: 'none', color: '#16334a', fontWeight: 600 }}
            >
              Download
            </Button>
          </Box>
        </Box>
      )}

      {state === 'error' && (
        <Alert
          severity="error"
          icon={<ErrorIcon />}
          onClose={() => {
            setError(null)
            setState(readyNarration ? 'ready' : 'idle')
          }}
          sx={{ borderRadius: 2 }}
        >
          {error}
        </Alert>
      )}

      <Typography variant="caption" sx={{ color: '#888', fontStyle: 'italic' }}>
        Narration uses a cloned voice and is AI-generated.{' '}
        {narrationSource === 'original'
          ? 'Reading the original story text.'
          : 'Reading the approved first-person narration.'}
      </Typography>
    </Box>
  )
}
