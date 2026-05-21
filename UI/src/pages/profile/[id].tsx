import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { Box, CircularProgress, IconButton, Tab, Tabs, Tooltip, Typography } from '@mui/material'
import { PhotoCamera as PhotoCameraIcon } from '@mui/icons-material'
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
              <Tab label="Memories" />
            </Tabs>

            <Box hidden={activeTab !== 0}>
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

            <Box hidden={activeTab !== 1}>
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
