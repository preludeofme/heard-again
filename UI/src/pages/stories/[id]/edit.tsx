import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { useRouter } from 'next/router'
import { useEffect, useState, useCallback } from 'react'
import {
  Box, Typography, TextField, Button, CircularProgress,
  ToggleButton, ToggleButtonGroup, Collapse,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material'
import { ArrowBack, Save, Delete, AutoFixHigh as RegenerateIcon } from '@mui/icons-material'
import { fetchWithCSRF } from '@/lib/api-client'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { ConfirmDialog } from '@/components/modals/ConfirmDialog'

type NarrationStatus = 'NONE' | 'PENDING' | 'READY' | 'APPROVED' | 'STALE' | 'FAILED'

const C = {
  primary: '#16334a',
  surface: '#fcf9f4',
  surfaceContainerLow: '#f6f3ee',
  surfaceContainerHigh: '#ebe8e3',
  secondaryContainer: '#d0e3e6',
  onSecondaryContainer: '#546669',
  outlineVariant: '#c3c7cd',
}

interface StoryEditData {
  id: string
  title: string
  content: string
  storyDate: string | null
  location: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  subject?: { id: string; firstName: string; lastName?: string | null } | null
  narratedContent?: string | null
  narrationStatus?: NarrationStatus
}

export default function StoryEditPage() {
  const router = useRouter()
  const { id } = router.query
  const storyId = typeof id === 'string' ? id : ''

  const [story, setStory] = useState<StoryEditData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [storyDate, setStoryDate] = useState('')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('PUBLISHED')
  const [showOptional, setShowOptional] = useState(false)
  const [narrationPromptOpen, setNarrationPromptOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [regeneratingNarration, setRegeneratingNarration] = useState(false)

  const fetchStory = useCallback(async () => {
    if (!storyId) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/stories/${storyId}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load story')
      const s: StoryEditData = data.data
      setStory(s)
      setTitle(s.title || '')
      setContent(s.content || '')
      setOriginalContent(s.content || '')
      setStoryDate(s.storyDate ? new Date(s.storyDate).toISOString().split('T')[0] : '')
      setLocation(s.location || '')
      setStatus((s.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED') as 'DRAFT' | 'PUBLISHED')
      if (s.storyDate || s.location) setShowOptional(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [storyId])

  useEffect(() => { fetchStory() }, [fetchStory])

  const contentChanged = content.trim() !== originalContent.trim()
  const hasExistingNarration =
    !!story?.narratedContent &&
    story.narrationStatus !== undefined &&
    story.narrationStatus !== 'NONE' &&
    story.narrationStatus !== 'FAILED'

  const performSave = async (regenerateNarration: boolean) => {
    setSaveError(null)
    setIsSaving(true)
    try {
      const res = await fetchWithCSRF(`/api/stories/${storyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          storyDate: storyDate || null,
          location: location.trim() || null,
          status,
          regenerateNarration,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save')

      if (regenerateNarration) {
        setRegeneratingNarration(true)
        try {
          await fetchWithCSRF(`/api/stories/${storyId}/rewrite-first-person`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          })
        } catch {
          // Narration failure won't block navigation — detail page shows the FAILED banner.
        } finally {
          setRegeneratingNarration(false)
        }
      }

      router.push(`/stories/${storyId}`)
    } catch (err: any) {
      setSaveError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setSaveError('Title and story content are required.')
      return
    }
    if (contentChanged && hasExistingNarration) {
      setNarrationPromptOpen(true)
      return
    }
    await performSave(false)
  }

  const handleDelete = async () => {
    setIsDeleteConfirmOpen(false)
    setIsDeleting(true)
    try {
      const res = await fetchWithCSRF(`/api/stories/${storyId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete')
      const subjectId = story?.subject?.id
      router.push(subjectId ? `/profile/${subjectId}` : '/stories')
    } catch (err: any) {
      setSaveError(err.message)
      setIsDeleting(false)
    }
  }

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      backgroundColor: C.surfaceContainerHigh,
      borderRadius: 2,
      '& fieldset': { border: 'none' },
      '&.Mui-focused': { backgroundColor: '#ffffff', boxShadow: `0 0 0 2px ${C.secondaryContainer}` },
    },
  }

  if (isLoading) {
    return (
      <Layout>
        <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress sx={{ color: C.primary }} />
        </Box>
      </Layout>
    )
  }

  if (error || !story) {
    return (
      <Layout>
        <Box sx={{ maxWidth: 600, mx: 'auto', px: 4, py: 12, textAlign: 'center' }}>
          <Typography color="error" sx={{ mb: 2 }}>{error || 'Story not found'}</Typography>
          <Button variant="contained" onClick={() => router.back()}>Go Back</Button>
        </Box>
      </Layout>
    )
  }

  return (
    <>
      <Head>
        <title>Edit Story - Heard Again</title>
      </Head>
      <Layout>
        <Box sx={{ minHeight: '100vh', backgroundColor: C.surface }}>
          {/* Top bar */}
          <Box sx={{ px: { xs: 3, md: 8 }, py: 3, display: 'flex', alignItems: 'center', gap: 2, borderBottom: `1px solid ${C.outlineVariant}` }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => router.push(`/stories/${storyId}`)}
              sx={{ color: C.primary, textTransform: 'none', fontWeight: 600 }}
            >
              Back
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="text"
              color="error"
              startIcon={<Delete />}
              onClick={() => setIsDeleteConfirmOpen(true)}
              disabled={isDeleting || isSaving}
              sx={{ textTransform: 'none' }}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={isSaving || isDeleting}
              sx={{
                background: `linear-gradient(135deg, ${C.primary} 0%, #2e4a62 100%)`,
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
              }}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>

          {/* Form */}
          <Box sx={{ maxWidth: 760, mx: 'auto', px: { xs: 3, md: 4 }, py: 6 }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-newsreader), serif',
                fontSize: '2rem',
                color: C.primary,
                mb: 4,
              }}
            >
              Edit Story
            </Typography>

            {saveError && (
              <Box sx={{ bgcolor: '#fce4ec', color: '#c62828', px: 2.5, py: 1.5, borderRadius: 2, mb: 3, fontSize: '0.9rem' }}>
                {saveError}
              </Box>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Title */}
              <TextField
                fullWidth
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                sx={fieldSx}
              />

              {/* Content */}
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: C.primary, fontWeight: 600 }}>Story</Typography>
                <RichTextEditor
                  content={content}
                  onChange={(html) => setContent(html)}
                  placeholder="Share your story..."
                />
              </Box>

              {/* Optional: date + location */}
              <Box>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setShowOptional(p => !p)}
                  sx={{ color: C.onSecondaryContainer, fontSize: '0.78rem', textTransform: 'none', px: 0.5, mb: 0.5 }}
                >
                  {showOptional ? '− Hide date & location' : '+ Edit date & location'}
                </Button>
                <Collapse in={showOptional}>
                  <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      type="date"
                      size="small"
                      label="Date"
                      InputLabelProps={{ shrink: true }}
                      value={storyDate}
                      onChange={(e) => setStoryDate(e.target.value)}
                      sx={{ flex: 1, ...fieldSx }}
                    />
                    <TextField
                      size="small"
                      label="Location"
                      placeholder="e.g. Chicago, IL"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      sx={{ flex: 1, ...fieldSx }}
                    />
                  </Box>
                </Collapse>
              </Box>

              {/* Status toggle */}
              <Box>
                <Typography variant="caption" sx={{ color: C.onSecondaryContainer, mb: 1, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Visibility
                </Typography>
                <ToggleButtonGroup
                  value={status}
                  exclusive
                  onChange={(_, val) => { if (val) setStatus(val) }}
                  size="small"
                  sx={{ gap: 1 }}
                >
                  <ToggleButton
                    value="PUBLISHED"
                    sx={{
                      borderRadius: '20px !important',
                      border: `1px solid ${C.outlineVariant} !important`,
                      px: 2.5,
                      textTransform: 'none',
                      fontWeight: 600,
                      '&.Mui-selected': { bgcolor: '#e8f5e9', color: '#2e7d32', borderColor: '#a5d6a7 !important' },
                    }}
                  >
                    Published
                  </ToggleButton>
                  <ToggleButton
                    value="DRAFT"
                    sx={{
                      borderRadius: '20px !important',
                      border: `1px solid ${C.outlineVariant} !important`,
                      px: 2.5,
                      textTransform: 'none',
                      fontWeight: 600,
                      '&.Mui-selected': { bgcolor: '#fff3e0', color: '#e65100', borderColor: '#ffcc80 !important' },
                    }}
                  >
                    Draft
                  </ToggleButton>
                </ToggleButtonGroup>
                <Typography variant="caption" sx={{ color: C.onSecondaryContainer, display: 'block', mt: 1 }}>
                  {status === 'PUBLISHED' ? 'Visible on the profile and story.' : 'Only visible to familyspace editors.'}
                </Typography>
              </Box>

              {/* Subject (read-only) */}
              {story.subject && (
                <Box sx={{ bgcolor: C.surfaceContainerLow, borderRadius: 2, px: 2.5, py: 1.5 }}>
                  <Typography variant="caption" sx={{ color: C.onSecondaryContainer, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    About
                  </Typography>
                  <Typography sx={{ color: C.primary, fontWeight: 500, mt: 0.25 }}>
                    {story.subject.firstName}{story.subject.lastName ? ` ${story.subject.lastName}` : ''}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        <Dialog
          open={narrationPromptOpen}
          onClose={() => !isSaving && !regeneratingNarration && setNarrationPromptOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ color: C.primary, fontWeight: 600 }}>
            {story?.narrationStatus === 'APPROVED'
              ? 'Update the approved narration?'
              : 'Update the prepared narration?'}
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: C.onSecondaryContainer }}>
              The story text has changed since the first-person narration was prepared.
              {story?.narrationStatus === 'APPROVED' &&
                ' Your approved narration will no longer match the story.'}
              {' '}Would you like to regenerate the narration now, or keep the existing version (it will be marked out-of-date)?
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
            <Button
              onClick={() => setNarrationPromptOpen(false)}
              disabled={isSaving || regeneratingNarration}
              sx={{ textTransform: 'none', color: C.onSecondaryContainer }}
            >
              Cancel
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              onClick={() => {
                setNarrationPromptOpen(false)
                performSave(false)
              }}
              disabled={isSaving || regeneratingNarration}
              variant="outlined"
              sx={{ textTransform: 'none', color: C.primary, borderColor: C.primary }}
            >
              Keep existing
            </Button>
            <Button
              onClick={() => {
                setNarrationPromptOpen(false)
                performSave(true)
              }}
              disabled={isSaving || regeneratingNarration}
              variant="contained"
              startIcon={
                regeneratingNarration ? (
                  <CircularProgress size={16} sx={{ color: 'white' }} />
                ) : (
                  <RegenerateIcon />
                )
              }
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                backgroundColor: C.primary,
                '&:hover': { backgroundColor: '#2e4a62' },
              }}
            >
              {regeneratingNarration ? 'Regenerating…' : 'Save & regenerate'}
            </Button>
          </DialogActions>
        </Dialog>

        <ConfirmDialog
          open={isDeleteConfirmOpen}
          title="Delete Story?"
          message="Are you sure you want to delete this story? This action cannot be undone."
          confirmLabel="Delete Story"
          confirmColor="error"
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setIsDeleteConfirmOpen(false)}
        />
      </Layout>
    </>
  )
}

export async function getServerSideProps() { return { props: {} } }
