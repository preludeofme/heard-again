import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
  IconButton,
  Alert,
  Chip,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Autocomplete,
  CircularProgress,
  Paper,
  Stack,
} from '@mui/material'
import {
  Close as CloseIcon,
  UploadFile as UploadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Person as PersonIcon,
  AccountTree as TreeIcon,
  FileUpload as FileIcon,
  CheckCircleOutline as CheckIcon,
} from '@mui/icons-material'
import { fetchWithCSRF } from '@/lib/api-client'
import { useSession } from 'next-auth/react'

interface GedcomImportModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  userPersonId?: string
}

interface GedcomIndividual {
  xref: string
  fullName: string
  firstName: string
  lastName: string | null
  birthDate: string | null
}

interface PreviewData {
  assetId: string
  preview: {
    potentialMatches: Array<{
      xref: string
      fullName: string
      firstName: string
      lastName: string | null
      confidence: number
    }>
    summary: {
      individualCount: number
      familyCount: number
    }
  }
  allIndividuals: GedcomIndividual[]
}

interface ExistingPerson {
  id: string
  firstName: string
  lastName: string | null
  displayName: string | null
  birthDate: string | null
}

type ConnectionMode = 'self' | 'attach' | 'standalone'

function gedcomLabel(ind: GedcomIndividual): string {
  return ind.birthDate ? `${ind.fullName} (b. ${ind.birthDate})` : ind.fullName
}

function personLabel(p: ExistingPerson): string {
  const name = p.displayName || `${p.firstName}${p.lastName ? ` ${p.lastName}` : ''}`
  return p.birthDate ? `${name} (b. ${p.birthDate})` : name
}

function PersonAutocomplete({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string
  options: GedcomIndividual[]
  value: GedcomIndividual | null
  onChange: (v: GedcomIndividual | null) => void
  placeholder?: string
}) {
  return (
    <Autocomplete
      value={value}
      onChange={(_, v) => onChange(v)}
      options={options}
      getOptionLabel={gedcomLabel}
      filterOptions={(opts, { inputValue }) => {
        if (inputValue.trim().length < 2) return []
        const words = inputValue.toLowerCase().trim().split(/\s+/)
        return opts.filter(o => {
          const first = o.firstName.toLowerCase()
          const last = (o.lastName ?? '').toLowerCase()
          const full = o.fullName.toLowerCase()
          return words.every(w => first.includes(w) || last.includes(w) || full.includes(w))
        }).slice(0, 50)
      }}
      noOptionsText="Type at least 2 characters to search"
      renderOption={(props, option) => (
        <li {...props} key={option.xref}>{gedcomLabel(option)}</li>
      )}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder} size="small" fullWidth />
      )}
      isOptionEqualToValue={(a, b) => a.xref === b.xref}
    />
  )
}

function ExistingPersonAutocomplete({
  label,
  options,
  loading,
  value,
  onChange,
  inputValue,
  onInputChange,
}: {
  label: string
  options: ExistingPerson[]
  loading: boolean
  value: ExistingPerson | null
  onChange: (v: ExistingPerson | null) => void
  inputValue: string
  onInputChange: (v: string) => void
}) {
  return (
    <Autocomplete
      value={value}
      onChange={(_, v) => onChange(v)}
      inputValue={inputValue}
      onInputChange={(_, v) => onInputChange(v)}
      options={options}
      getOptionLabel={personLabel}
      filterOptions={(opts) => opts}  // server already filters
      loading={loading}
      noOptionsText={inputValue.trim().length < 2 ? 'Type at least 2 characters to search' : 'No matches found'}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>{personLabel(option)}</li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          size="small"
          fullWidth
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      isOptionEqualToValue={(a, b) => a.id === b.id}
    />
  )
}

export function GedcomImportModal({ open, onClose, onSuccess, userPersonId }: GedcomImportModalProps) {
  const { data: session } = useSession()

  // Upload state
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'preview' | 'processing' | 'polling' | 'success' | 'error'>('idle')
  const [jobId, setJobId] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)

  // Connection mode
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('self')

  // "I'm in this file" state
  const [selfXref, setSelfXref] = useState<string | null>(null)           // which GEDCOM person is the user
  const [selfSearch, setSelfSearch] = useState<GedcomIndividual | null>(null) // manual search result
  const [gedcomFather, setGedcomFather] = useState<GedcomIndividual | null>(null)
  const [gedcomMother, setGedcomMother] = useState<GedcomIndividual | null>(null)

  // "Connect to my tree" state — server-side search to handle large trees
  const [anchorSearch, setAnchorSearch] = useState('')
  const [existingOptions, setExistingOptions] = useState<ExistingPerson[]>([])
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [anchorPerson, setAnchorPerson] = useState<ExistingPerson | null>(null)
  const [gedcomParent, setGedcomParent] = useState<GedcomIndividual | null>(null)
  const [parentRole, setParentRole] = useState<'father' | 'mother'>('father')

  const resetModal = () => {
    setFile(null)
    setStatus('idle')
    setError(null)
    setPreviewData(null)
    setJobId(null)
    setImportProgress(0)
    setConnectionMode('self')
    setSelfXref(null)
    setSelfSearch(null)
    setGedcomFather(null)
    setGedcomMother(null)
    setAnchorSearch('')
    setExistingOptions([])
    setAnchorPerson(null)
    setGedcomParent(null)
    setParentRole('father')
  }

  // Debounced server-side search for existing tree people
  useEffect(() => {
    if (anchorSearch.trim().length < 2) {
      setExistingOptions([])
      return
    }
    const timer = setTimeout(async () => {
      setLoadingExisting(true)
      try {
        const resp = await fetch(
          `/api/people?search=${encodeURIComponent(anchorSearch)}&limit=50`,
          { credentials: 'include' }
        )
        const data = await resp.json()
        setExistingOptions(
          (data.data?.people || data.data || []).map((p: any) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName ?? null,
            displayName: p.displayName ?? null,
            birthDate: p.birthDate ? String(new Date(p.birthDate).getFullYear()) : null,
          }))
        )
      } catch {
        setExistingOptions([])
      } finally {
        setLoadingExisting(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [anchorSearch])

  // Slowly advance the simulated progress bar while polling (caps at 90 until job finishes)
  useEffect(() => {
    if (status !== 'polling') return
    setImportProgress(0)
    const timer = setInterval(() => {
      setImportProgress(p => Math.min(p + 1.5, 90))
    }, 500)
    return () => clearInterval(timer)
  }, [status])

  // Poll job status while import is processing in background
  useEffect(() => {
    if (status !== 'polling' || !jobId) return
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`/api/import/jobs/${jobId}`, { credentials: 'include' })
        if (!resp.ok) return
        const data = await resp.json()
        const jobStatus: string = data.data?.status
        if (jobStatus === 'COMPLETED') {
          clearInterval(interval)
          setImportProgress(100)
          setTimeout(() => { setStatus('success'); onSuccess?.() }, 400)
        } else if (jobStatus === 'FAILED') {
          clearInterval(interval)
          setError(data.data?.errorMessage || 'Import failed during processing')
          setStatus('error')
        }
      } catch {
        // transient network error — keep polling
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [status, jobId, onSuccess])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0])
      setError(null)
    }
  }

  const handleUploadAndPreview = async () => {
    if (!file) return
    setStatus('uploading')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetchWithCSRF('/api/import/gedcom-preview', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to preview GEDCOM file')
      }

      const data = await response.json()
      setPreviewData(data.data)
      setStatus('preview')

      // Auto-select the top match if high confidence
      if (data.data.preview.potentialMatches[0]?.confidence > 0.8) {
        setSelfXref(data.data.preview.potentialMatches[0].xref)
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during preview')
      setStatus('error')
    }
  }

  const handleConfirmImport = async () => {
    if (!previewData) return
    setStatus('processing')

    try {
      const options: Record<string, string> = {}

      if (connectionMode === 'self') {
        const chosenXref = selfXref ?? selfSearch?.xref
        if (chosenXref) {
          options.gedcomXrefForLink = chosenXref
          // Pass the explicit person ID so the service merges into the correct record
          // rather than relying on unreliable createdById lookup
          if (userPersonId) options.linkToPersonId = userPersonId
        }
        if (gedcomFather) options.fatherXref = gedcomFather.xref
        if (gedcomMother) options.motherXref = gedcomMother.xref
      } else if (connectionMode === 'attach' && anchorPerson && gedcomParent) {
        options.linkToPersonId = anchorPerson.id
        if (parentRole === 'father') options.fatherXref = gedcomParent.xref
        else options.motherXref = gedcomParent.xref
      }
      // standalone: no options

      const response = await fetchWithCSRF('/api/import/gedcom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: previewData.assetId, options }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to start GEDCOM import')
      }

      const data = await response.json()
      setJobId(data.data?.jobId ?? null)
      setStatus('polling')
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during import')
      setStatus('error')
    }
  }

  const selectedSelfLabel = useMemo(() => {
    if (!previewData) return null
    if (selfXref) {
      const match = previewData.preview.potentialMatches.find(m => m.xref === selfXref)
        || previewData.allIndividuals.find(i => i.xref === selfXref)
      return match?.fullName ?? null
    }
    return selfSearch?.fullName ?? null
  }, [selfXref, selfSearch, previewData])

  const canConfirm = (() => {
    if (connectionMode === 'standalone') return true
    if (connectionMode === 'self') return true  // everything optional
    if (connectionMode === 'attach') return !!(anchorPerson && gedcomParent)
    return false
  })()

  return (
    <Dialog
      open={open}
      onClose={status === 'uploading' || status === 'processing' || status === 'polling' ? undefined : onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="span" sx={{ fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.6 }}>
          {status === 'preview' ? 'Connect Your Family Tree' : 'Import GEDCOM File'}
        </Typography>
        <IconButton
          onClick={onClose}
          disabled={status === 'uploading' || status === 'processing' || status === 'polling'}
          sx={{ color: 'grey.500' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>

        {/* ── IDLE ─────────────────────────────────────────── */}
        {status === 'idle' && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <UploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2, opacity: 0.5 }} />
            <Typography variant="body1" gutterBottom>
              Select a GEDCOM file (.ged) to import your family tree.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              This will add new people and relationships to your current family space.
            </Typography>
            <input
              accept=".ged"
              style={{ display: 'none' }}
              id="gedcom-file-input"
              type="file"
              onChange={handleFileChange}
            />
            <label htmlFor="gedcom-file-input">
              <Button variant="outlined" component="span" startIcon={<UploadIcon />}>
                {file ? file.name : 'Choose File'}
              </Button>
            </label>
            {file && (
              <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                {(file.size / 1024).toFixed(1)} KB
              </Typography>
            )}
          </Box>
        )}

        {/* ── UPLOADING / PROCESSING ────────────────────────── */}
        {(status === 'uploading' || status === 'processing') && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              {status === 'uploading' ? 'Analyzing file…' : 'Queuing import…'}
            </Typography>
            <Box sx={{ width: '100%', px: 4, mt: 2 }}>
              <LinearProgress sx={{ height: 8, borderRadius: 4 }} />
            </Box>
          </Box>
        )}

        {/* ── POLLING ──────────────────────────────────────── */}
        {status === 'polling' && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>Processing your family tree…</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              This may take a minute for large files. Please keep this window open.
            </Typography>
            <Box sx={{ px: 4 }}>
              <LinearProgress
                variant="determinate"
                value={importProgress}
                sx={{ height: 10, borderRadius: 5 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                {importProgress < 90 ? 'Importing people and relationships…' : 'Finalizing…'}
              </Typography>
            </Box>
          </Box>
        )}

        {/* ── PREVIEW ──────────────────────────────────────── */}
        {status === 'preview' && previewData && (
          <Box sx={{ py: 1 }}>
            {/* Summary */}
            <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2, display: 'flex', gap: 3 }}>
              <Typography variant="body2">
                <strong>{previewData.preview.summary.individualCount.toLocaleString()}</strong> people
              </Typography>
              <Typography variant="body2">
                <strong>{previewData.preview.summary.familyCount.toLocaleString()}</strong> families
              </Typography>
            </Box>

            {/* Mode selector */}
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
              How does this file connect to your existing tree?
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
              {([
                { value: 'self', icon: <PersonIcon />, title: "I'm in this file", desc: 'Link yourself to a record in the file' },
                { value: 'attach', icon: <TreeIcon />, title: 'Connect to someone', desc: 'Attach an imported person as a parent of someone in your tree' },
                { value: 'standalone', icon: <FileIcon />, title: 'Just import', desc: 'Import as a standalone tree, connect later' },
              ] as const).map(({ value, icon, title, desc }) => (
                <Paper
                  key={value}
                  variant="outlined"
                  onClick={() => setConnectionMode(value)}
                  sx={{
                    flex: 1,
                    p: 2,
                    cursor: 'pointer',
                    borderColor: connectionMode === value ? 'primary.main' : 'divider',
                    bgcolor: connectionMode === value ? 'primary.50' : 'transparent',
                    borderWidth: connectionMode === value ? 2 : 1,
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    {React.cloneElement(icon, { fontSize: 'small', color: connectionMode === value ? 'primary' : 'action' } as any)}
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {title}
                    </Typography>
                    {connectionMode === value && (
                      <CheckIcon sx={{ ml: 'auto', fontSize: 16, color: 'primary.main' }} />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">{desc}</Typography>
                </Paper>
              ))}
            </Stack>

            <Divider sx={{ mb: 3 }} />

            {/* ── MODE: SELF ───────────────────────────────── */}
            {connectionMode === 'self' && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  Select yourself in the file
                </Typography>

                {/* Auto-detected matches */}
                {previewData.preview.potentialMatches.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      Suggested matches
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {previewData.preview.potentialMatches.map(m => (
                        <Chip
                          key={m.xref}
                          label={
                            <span>
                              {m.fullName}
                              <span style={{ marginLeft: 6, fontSize: '0.7rem', opacity: 0.8 }}>
                                {Math.round(m.confidence * 100)}% match
                              </span>
                            </span>
                          }
                          onClick={() => { setSelfXref(m.xref); setSelfSearch(null) }}
                          onDelete={selfXref === m.xref ? () => setSelfXref(null) : undefined}
                          color={selfXref === m.xref ? 'primary' : 'default'}
                          variant={selfXref === m.xref ? 'filled' : 'outlined'}
                          icon={selfXref === m.xref ? <CheckIcon /> : undefined}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Manual search */}
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  {previewData.preview.potentialMatches.length > 0
                    ? 'Not listed above? Search the full file:'
                    : 'Search for yourself in the file:'}
                </Typography>
                <PersonAutocomplete
                  label="Search by name (type 2+ characters)"
                  options={previewData.allIndividuals}
                  value={selfSearch}
                  onChange={(v) => { setSelfSearch(v); if (v) setSelfXref(null) }}
                  placeholder="e.g. John Smith"
                />
                {(selfXref || selfSearch) && (
                  <Alert severity="success" icon={<CheckIcon />} sx={{ mt: 1.5, py: 0.5 }}>
                    Matched to <strong>{selectedSelfLabel}</strong>
                  </Alert>
                )}

                {/* Optional parents from GEDCOM */}
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    Optional: add your parents from this file
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                    Skip this if your parents aren't in the file, or you prefer to connect them manually.
                  </Typography>
                  <Stack spacing={1.5}>
                    <PersonAutocomplete
                      label="Father (from imported file)"
                      options={previewData.allIndividuals}
                      value={gedcomFather}
                      onChange={setGedcomFather}
                    />
                    <PersonAutocomplete
                      label="Mother (from imported file)"
                      options={previewData.allIndividuals}
                      value={gedcomMother}
                      onChange={setGedcomMother}
                    />
                  </Stack>
                </Box>
              </Box>
            )}

            {/* ── MODE: ATTACH ─────────────────────────────── */}
            {connectionMode === 'attach' && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Connect an imported person as a parent
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                  Choose someone already in your tree, then select who in the imported file is their parent.
                </Typography>

                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
                      Step 1 — Person in your existing tree
                    </Typography>
                    <ExistingPersonAutocomplete
                      label="Search your existing tree (type 2+ characters)"
                      options={existingOptions}
                      loading={loadingExisting}
                      value={anchorPerson}
                      onChange={setAnchorPerson}
                      inputValue={anchorSearch}
                      onInputChange={setAnchorSearch}
                    />
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
                      Step 2 — Their parent in the imported file
                    </Typography>
                    <PersonAutocomplete
                      label="Search imported file (type 2+ characters)"
                      options={previewData.allIndividuals}
                      value={gedcomParent}
                      onChange={setGedcomParent}
                    />
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
                      Step 3 — Relationship
                    </Typography>
                    <ToggleButtonGroup
                      value={parentRole}
                      exclusive
                      onChange={(_, v) => { if (v) setParentRole(v) }}
                      size="small"
                    >
                      <ToggleButton value="father">Father</ToggleButton>
                      <ToggleButton value="mother">Mother</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>

                  {anchorPerson && gedcomParent && (
                    <Alert severity="info" sx={{ py: 0.5 }}>
                      <strong>{gedcomParent.fullName}</strong> will be imported as{' '}
                      <strong>{personLabel(anchorPerson)}</strong>'s {parentRole}.
                    </Alert>
                  )}
                </Stack>
              </Box>
            )}

            {/* ── MODE: STANDALONE ─────────────────────────── */}
            {connectionMode === 'standalone' && (
              <Alert severity="info">
                The file will be imported as a standalone tree. You can connect people to your existing tree
                from the family tree view afterwards.
              </Alert>
            )}
          </Box>
        )}

        {/* ── SUCCESS ──────────────────────────────────────── */}
        {status === 'success' && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <SuccessIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>Import Started!</Typography>
            <Typography variant="body1">
              Your family tree is being processed in the background.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              The tree will refresh automatically once the import is complete.
            </Typography>
          </Box>
        )}

        {/* ── ERROR ────────────────────────────────────────── */}
        {status === 'error' && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
            <Typography variant="h6" color="error" gutterBottom>Import Failed</Typography>
            <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>{error}</Alert>
            <Button onClick={resetModal} sx={{ mt: 3 }}>Try Again</Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        {status === 'idle' && (
          <>
            <Button onClick={onClose} color="inherit">Cancel</Button>
            <Button
              onClick={handleUploadAndPreview}
              variant="contained"
              disabled={!file}
              sx={{ bgcolor: '#16334a', '&:hover': { bgcolor: '#2e4a62' } }}
            >
              Analyze File
            </Button>
          </>
        )}
        {status === 'preview' && (
          <>
            <Button onClick={resetModal} color="inherit">Back</Button>
            <Button
              onClick={handleConfirmImport}
              variant="contained"
              disabled={!canConfirm}
              sx={{ bgcolor: '#16334a', '&:hover': { bgcolor: '#2e4a62' } }}
            >
              {connectionMode === 'standalone' ? 'Import' : 'Import & Connect'}
            </Button>
          </>
        )}
        {status === 'success' && (
          <Button onClick={onClose} variant="contained" color="success">Done</Button>
        )}
        {status === 'error' && (
          <Button onClick={onClose} color="inherit">Close</Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
