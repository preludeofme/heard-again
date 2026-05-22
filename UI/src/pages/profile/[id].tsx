import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, CircularProgress, IconButton, Paper, Tab, Tabs, Tooltip, Typography } from '@mui/material'
import { PhotoCamera as PhotoCameraIcon, Timeline as TimelineIcon } from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import { VoiceSignature } from '@/components/profile/VoiceSignature'
import { MiniFamilyTree } from '@/components/profile/MiniFamilyTree'
import { NarrativeTimeline } from '@/components/profile/NarrativeTimeline'
import { fetchWithCSRF } from '@/lib/api-client'
import { resizeImageFile } from '@/lib/resize-image'
import { MemoriesGrid } from '@/components/profile/MemoriesGrid'

interface PersonDetails {
  id: string
  firstName: string
  lastName?: string | null
  displayName?: string | null
  nickname?: string | null
  birthDate?: string | null
  deathDate?: string | null
  isDeceased?: boolean
  bio?: string | null
  avatarUrl?: string | null
  voiceProfiles?: Array<{ id: string; name: string; isDefault: boolean; isCloned: boolean; sampleAudioUrl?: string | null }>
  relationships?: Array<{
    id: string
    type: 'PARENT' | 'CHILD' | 'SPOUSE'
    person: { id: string; firstName: string; lastName?: string | null }
  }>
}

interface Story {
  id: string
  title: string
  content: string
  excerpt?: string | null
  storyDate?: string | null
  createdAt: string
}

interface DocItem {
  id: string
  title: string
  documentType?: string
  dateOccurred?: string | null
  asset?: { id: string; storagePath: string; mimeType: string }
}

interface TimelineEvent {
  id: string
  type: 'birth' | 'death' | 'marriage' | 'divorce' | 'story' | 'document' | 'custom'
  date: string | null
  datePrecision: string
  title: string
  description?: string
  people: Array<{
    id: string
    firstName: string
    lastName?: string
    displayName?: string
    avatarAssetId?: string
    role?: string
  }>
  metadata?: Record<string, unknown>
  sourceId: string
  sourceType: string
}

type TimelineFilter = 'all' | 'events' | 'stories' | 'milestones'

const FILTER_OPTIONS: Array<{ label: string; value: TimelineFilter; types: TimelineEvent['type'][] }> = [
  { label: 'All', value: 'all', types: [] },
  { label: 'Events', value: 'events', types: ['birth', 'death', 'marriage', 'divorce', 'custom'] },
  { label: 'Stories', value: 'stories', types: ['story'] },
  { label: 'Milestones', value: 'milestones', types: ['custom'] },
]

function formatEventDate(date: string | null, precision: string): string {
  if (!date) return 'Unknown date'
  const d = new Date(date)
  switch (precision) {
    case 'EXACT':
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    case 'YEAR_MONTH':
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    case 'YEAR':
      return d.getFullYear().toString()
    case 'DECADE':
      return `${Math.floor(d.getFullYear() / 10) * 10}s`
    case 'APPROXIMATE':
      return `c. ${d.getFullYear()}`
    default:
      return d.toLocaleDateString()
  }
}

const fullName = (p: { firstName?: string; lastName?: string | null; displayName?: string | null }) =>
  p.displayName || `${p.firstName || ''}${p.lastName ? ` ${p.lastName}` : ''}`.trim() || 'Unnamed'

const toYear = (d?: string | null) => (d ? new Date(d).getFullYear() : null)

export default function PersonProfilePage() {
  const router = useRouter()
  const { id } = router.query
  const personId = typeof id === 'string' ? id : ''
  const { selectedFamilyMember, setSelectedFamilyMember } = useSelectedFamilyMember()

  const [person, setPerson] = useState<PersonDetails | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [documents, setDocuments] = useState<DocItem[]>([])
  const [docTotal, setDocTotal] = useState(0)
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [isTimelineLoading, setIsTimelineLoading] = useState(false)
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarUpload = async (file: File) => {
    if (!personId) return
    setIsUploadingAvatar(true)
    try {
      const resized = await resizeImageFile(file)
      const form = new FormData()
      form.append('file', resized)
      const res = await fetchWithCSRF(`/api/people/${personId}/avatar`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      const newAvatarUrl = data.data?.avatarAssetId
        ? `/api/assets/serve/${data.data.avatarAssetId}`
        : null
      if (newAvatarUrl) {
        setPerson(prev => {
          if (!prev) return prev
          const updated = { ...prev, avatarUrl: newAvatarUrl }
          setSelectedFamilyMember({
            id: updated.id,
            firstName: updated.firstName,
            lastName: updated.lastName,
            displayName: updated.displayName,
            avatarUrl: newAvatarUrl,
          })
          return updated
        })
      }
    } catch {
      // silently fail — user sees no change
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  // 1. URL -> State Sync: When a profile is loaded, update the global selection
  useEffect(() => {
    if (person && selectedFamilyMember?.id !== person.id) {
      setSelectedFamilyMember({
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        displayName: person.displayName,
        avatarUrl: person.avatarUrl,
      })
    }
  }, [person, selectedFamilyMember?.id, setSelectedFamilyMember])

  // 2. State -> URL Sync: When the active member changes via the header switcher, navigate to their profile.
  // We only trigger this when selectedFamilyMember changes to avoid fighting direct URL navigation.
  useEffect(() => {
    if (selectedFamilyMember && selectedFamilyMember.id !== personId && personId) {
      router.push(`/profile/${selectedFamilyMember.id}`)
    }
  }, [selectedFamilyMember?.id, router]) // Removed personId from dependencies

  const timelineRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragScrollLeft, setDragScrollLeft] = useState(0)
  const [hasDragged, setHasDragged] = useState(false)

  const refreshDocuments = () => {
    if (!personId) return
    fetch(`/api/documents?personId=${personId}&limit=4`, { credentials: 'include' })
      .then(r => r.json())
      .then(dData => {
        if (dData.success) {
          setDocuments(dData.data || [])
          setDocTotal(dData.pagination?.total || 0)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    if (!personId) return
    let active = true
    setIsLoading(true)

    Promise.all([
      fetch(`/api/people/${personId}`, { credentials: 'include' }),
      fetch(`/api/stories?subjectId=${personId}&limit=20`, { credentials: 'include' }),
      fetch(`/api/documents?personId=${personId}&limit=4`, { credentials: 'include' }),
    ])
      .then(([pRes, sRes, dRes]) => Promise.all([pRes.json(), sRes.json(), dRes.json()]))
      .then(([pData, sData, dData]) => {
        if (!active) return
        if (pData.success) setPerson(pData.data)
        if (sData.success) setStories(sData.data?.stories || [])
        if (dData.success) {
          setDocuments(dData.data || [])
          setDocTotal(dData.pagination?.total || 0)
        }
      })
      .finally(() => { if (active) setIsLoading(false) })

    return () => { active = false }
  }, [personId])

  useEffect(() => {
    if (!personId) return
    let active = true
    setIsTimelineLoading(true)
    fetch(`/api/timeline?personId=${personId}&limit=50`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (!active) return
        if (data.success) setTimelineEvents(data.data || [])
      })
      .catch(() => {})
      .finally(() => { if (active) setIsTimelineLoading(false) })
    return () => { active = false }
  }, [personId])

  const filteredTimelineEvents = useMemo(() => {
    const filter = FILTER_OPTIONS.find(f => f.value === timelineFilter)
    if (!filter || filter.value === 'all') return timelineEvents
    return timelineEvents.filter(e => filter.types.includes(e.type))
  }, [timelineEvents, timelineFilter])

  if (isLoading) {
    return (
      <Layout>
        <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress sx={{ color: ProfileColors.primary }} />
        </Box>
      </Layout>
    )
  }

  if (!person) {
    return (
      <Layout>
        <Box sx={{ maxWidth: 600, mx: 'auto', px: 4, py: 12, textAlign: 'center' }}>
          <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '2.5rem', color: ProfileColors.primary }}>
            Profile not found
          </Typography>
        </Box>
      </Layout>
    )
  }

  const name = fullName(person)
  const birthYear = toYear(person.birthDate)
  const deathYear = toYear(person.deathDate)

  const onDragStart = (e: React.MouseEvent) => {
    if (!timelineRef.current) return
    setIsDragging(true)
    setHasDragged(false)
    setDragStartX(e.pageX - timelineRef.current.offsetLeft)
    setDragScrollLeft(timelineRef.current.scrollLeft)
  }

  const onDragMove = (e: React.MouseEvent) => {
    if (!isDragging || !timelineRef.current) return
    e.preventDefault()
    const x = e.pageX - timelineRef.current.offsetLeft
    const delta = (x - dragStartX) * 1.4
    if (Math.abs(delta) > 4) setHasDragged(true)
    timelineRef.current.scrollLeft = dragScrollLeft - delta
  }

  const onDragEnd = () => setIsDragging(false)

  const onTouchStart = (e: React.TouchEvent) => {
    if (!timelineRef.current) return
    setDragStartX(e.touches[0].pageX)
    setDragScrollLeft(timelineRef.current.scrollLeft)
    setIsDragging(true)
    setHasDragged(false)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !timelineRef.current) return
    const delta = (e.touches[0].pageX - dragStartX) * 1.4
    if (Math.abs(delta) > 4) setHasDragged(true)
    timelineRef.current.scrollLeft = dragScrollLeft - delta
  }

  return (
    <>
      <Head>
        <title>{name} | Heard Again</title>
      </Head>
      <Layout>
        <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 3, md: 6 }, pt: { xs: 4, md: 8 }, pb: 20, bgcolor: ProfileColors.surface, minHeight: '100vh' }}>

          {/* ─── Profile Header ─── */}
          <Box
            component="section"
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'center', md: 'flex-start' },
              gap: { xs: 4, md: 7 },
              mb: { xs: 8, md: 14 },
            }}
          >
            {/* Portrait */}
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleAvatarUpload(file)
                  e.target.value = ''
                }}
              />
              <Box
                sx={{
                  width: { xs: 150, md: 190 },
                  height: { xs: 150, md: 190 },
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '7px solid #fff',
                  boxShadow: '0 10px 40px rgba(28,28,25,0.08)',
                  bgcolor: ProfileColors.surfaceContainerHigh,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {person.avatarUrl ? (
                  <Box
                    component="img"
                    src={person.avatarUrl}
                    alt={name}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(20%)' }}
                  />
                ) : (
                  <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '4.5rem', color: ProfileColors.primary, fontWeight: 700, lineHeight: 1 }}>
                    {person.firstName?.[0] ?? '?'}
                  </Typography>
                )}
              </Box>

              {/* Camera upload overlay */}
              <Tooltip title="Change profile photo">
                <IconButton
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  size="small"
                  sx={{
                    position: 'absolute',
                    bottom: 4,
                    left: 4,
                    bgcolor: 'rgba(255,255,255,0.92)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    '&:hover': { bgcolor: '#fff' },
                  }}
                  aria-label="Change profile photo"
                >
                  {isUploadingAvatar ? (
                    <CircularProgress size={18} sx={{ color: ProfileColors.primary }} />
                  ) : (
                    <PhotoCameraIcon sx={{ fontSize: 18, color: ProfileColors.primary }} />
                  )}
                </IconButton>
              </Tooltip>

              {(birthYear || deathYear) && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: -10,
                    right: -10,
                    bgcolor: ProfileColors.primary,
                    color: '#fff',
                    px: 2.5,
                    py: 0.75,
                    borderRadius: '9999px',
                    fontFamily: 'var(--font-newsreader), serif',
                    fontStyle: 'italic',
                    fontSize: '0.82rem',
                    boxShadow: '0 4px 14px rgba(22,51,74,0.35)',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.01em',
                  }}
                >
                  {birthYear && deathYear
                    ? `${birthYear} — ${deathYear}`
                    : birthYear
                    ? `b. ${birthYear}`
                    : `d. ${deathYear}`}
                </Box>
              )}
            </Box>

            {/* Text */}
            <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'left' } }}>
              <Typography
                component="h1"
                sx={{
                  fontFamily: 'var(--font-newsreader), serif',
                  fontSize: { xs: '3rem', sm: '3.75rem', md: '4.75rem' },
                  fontWeight: 700,
                  color: ProfileColors.primary,
                  letterSpacing: '-0.025em',
                  lineHeight: 1,
                }}
              >
                {name}
              </Typography>
              {person.nickname && (
                <Typography
                  sx={{
                    fontFamily: 'var(--font-newsreader), serif',
                    fontStyle: 'italic',
                    fontSize: '1.35rem',
                    color: ProfileColors.onSurfaceVariant,
                    mt: 1,
                  }}
                >
                  {person.nickname}
                </Typography>
              )}
              {person.bio && (
                <Typography
                  sx={{
                    fontFamily: 'var(--font-manrope), sans-serif',
                    fontSize: '1.05rem',
                    color: ProfileColors.onSurfaceVariant,
                    lineHeight: 1.7,
                    mt: 2.5,
                    maxWidth: 560,
                    mx: { xs: 'auto', md: 0 },
                  }}
                >
                  {person.bio}
                </Typography>
              )}

            </Box>
          </Box>

          {/* ─── Bento Grid ─── */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(12, 1fr)' },
              gap: 3,
              mb: { xs: 8, md: 14 },
            }}
          >
            <VoiceSignature 
              personId={personId}
              firstName={person.firstName}
              bio={person.bio}
              voiceProfiles={person.voiceProfiles}
            />

            <MiniFamilyTree 
              personId={personId}
              firstName={person.firstName}
              avatarUrl={person.avatarUrl}
              relationships={person.relationships as any}
            />
          </Box>

          {/* ─── Content Tabs ─── */}
          <Box>
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              sx={{
                mb: 4,
                borderBottom: `1px solid ${ProfileColors.outlineVariant}`,
                '& .MuiTab-root': {
                  fontFamily: 'var(--font-manrope), sans-serif',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  color: ProfileColors.onSurfaceVariant,
                  textTransform: 'none',
                  minWidth: 120,
                },
                '& .Mui-selected': { color: ProfileColors.primary },
                '& .MuiTabs-indicator': { backgroundColor: ProfileColors.primary },
              }}
            >
              <Tab label="Timeline" />
              <Tab label="Narrative" />
              <Tab label="Memories" />
            </Tabs>

            {/* ── Timeline Tab ── */}
            <Box hidden={activeTab !== 0}>
              {/* Filter chips */}
              <Paper
                elevation={0}
                sx={{
                  display: 'flex',
                  p: 0.75,
                  mb: 5,
                  borderRadius: '999px',
                  backgroundColor: ProfileColors.surfaceContainerLow,
                  border: `1px solid ${ProfileColors.outlineVariant}20`,
                  width: 'fit-content',
                  overflowX: 'auto',
                  '&::-webkit-scrollbar': { display: 'none' },
                }}
              >
                {FILTER_OPTIONS.map(opt => (
                  <Button
                    key={opt.value}
                    onClick={() => setTimelineFilter(opt.value)}
                    sx={{
                      px: 3,
                      py: 1,
                      borderRadius: '999px',
                      textTransform: 'none',
                      fontFamily: 'var(--font-manrope), sans-serif',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      whiteSpace: 'nowrap',
                      color: timelineFilter === opt.value ? ProfileColors.primary : ProfileColors.onSurfaceVariant,
                      backgroundColor: timelineFilter === opt.value ? ProfileColors.surfaceContainerLowest : 'transparent',
                      boxShadow: timelineFilter === opt.value ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                      '&:hover': {
                        backgroundColor: timelineFilter === opt.value
                          ? ProfileColors.surfaceContainerLowest
                          : 'rgba(0,0,0,0.03)',
                      },
                    }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </Paper>

              {/* Timeline event list */}
              {isTimelineLoading ? (
                <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress sx={{ color: ProfileColors.primary }} size={28} />
                </Box>
              ) : filteredTimelineEvents.length === 0 ? (
                <Box sx={{ py: 10, textAlign: 'center', border: `2px dashed ${ProfileColors.outlineVariant}30`, borderRadius: 6 }}>
                  <TimelineIcon sx={{ fontSize: 48, color: ProfileColors.outlineVariant, opacity: 0.4, mb: 1.5 }} />
                  <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '1.2rem', fontStyle: 'italic', color: ProfileColors.onSurfaceVariant }}>
                    No {timelineFilter === 'all' ? 'timeline events' : timelineFilter} recorded yet.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {filteredTimelineEvents.map(event => {
                    const typeColors: Record<string, string> = {
                      birth: '#4caf50',
                      death: '#757575',
                      marriage: '#e91e63',
                      divorce: '#ff9800',
                      story: ProfileColors.primary,
                      document: '#adcae6',
                      custom: '#9c27b0',
                    }
                    const color = typeColors[event.type] ?? ProfileColors.primary
                    const typeLabel: Record<string, string> = {
                      birth: 'Birth',
                      death: 'Death',
                      marriage: 'Marriage',
                      divorce: 'Divorce',
                      story: 'Story',
                      document: 'Document',
                      custom: 'Milestone',
                    }
                    return (
                      <Box
                        key={event.id}
                        sx={{
                          display: 'flex',
                          gap: 3,
                          alignItems: 'flex-start',
                          p: 3.5,
                          borderRadius: 5,
                          bgcolor: ProfileColors.surfaceContainerLowest,
                          border: `1px solid ${ProfileColors.outlineVariant}15`,
                          boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
                          transition: 'box-shadow 0.2s, transform 0.2s',
                          '&:hover': {
                            boxShadow: '0 6px 24px rgba(0,0,0,0.07)',
                            transform: 'translateY(-2px)',
                          },
                        }}
                      >
                        {/* Colored dot */}
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: color,
                            flexShrink: 0,
                            mt: '6px',
                            boxShadow: `0 0 0 3px ${color}20`,
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
                            <Typography
                              sx={{
                                fontFamily: 'var(--font-manrope), sans-serif',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                color,
                              }}
                            >
                              {typeLabel[event.type] ?? 'Event'}
                            </Typography>
                            {event.date && (
                              <Typography
                                sx={{
                                  fontFamily: 'var(--font-manrope), sans-serif',
                                  fontSize: '0.72rem',
                                  color: ProfileColors.onSurfaceVariant,
                                  opacity: 0.7,
                                }}
                              >
                                {formatEventDate(event.date, event.datePrecision)}
                              </Typography>
                            )}
                          </Box>
                          <Typography
                            sx={{
                              fontFamily: 'var(--font-newsreader), serif',
                              fontSize: '1.1rem',
                              fontWeight: 600,
                              color: ProfileColors.primary,
                              lineHeight: 1.3,
                            }}
                          >
                            {event.title}
                          </Typography>
                          {event.description && (
                            <Typography
                              sx={{
                                fontFamily: 'var(--font-manrope), sans-serif',
                                fontSize: '0.88rem',
                                color: ProfileColors.onSurfaceVariant,
                                mt: 0.75,
                                lineHeight: 1.6,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {event.description}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              )}
            </Box>

            {/* ── Narrative Tab ── */}
            <Box hidden={activeTab !== 1}>
              <NarrativeTimeline
                stories={stories}
                personId={personId}
                timelineRef={timelineRef}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                hasDragged={hasDragged}
              />
            </Box>

            {/* ── Memories Tab ── */}
            <Box hidden={activeTab !== 2}>
              <MemoriesGrid
                documents={documents}
                docTotal={docTotal}
                personId={personId}
                onUploadSuccess={refreshDocuments}
              />
            </Box>
          </Box>

        </Box>
      </Layout>
    </>
  )
}

export async function getServerSideProps() { return { props: {} } }
