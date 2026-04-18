import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { Avatar, Box, CircularProgress, IconButton, Typography } from '@mui/material'
import { Replay10, Forward30, PlayArrow } from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'

const C = {
  primary: '#16334a',
  primaryContainer: '#2e4a62',
  surface: '#fcf9f4',
  surfaceContainerLow: '#f6f3ee',
  surfaceContainerLowest: '#ffffff',
  surfaceContainer: '#f0ede8',
  surfaceContainerHigh: '#ebe8e3',
  secondaryContainer: '#d0e3e6',
  onSecondaryContainer: '#546669',
  tertiaryFixed: '#feddb4',
  tertiaryFixedDim: '#e0c29a',
  onTertiaryFixedVariant: '#584325',
  onSurface: '#1c1c19',
  onSurfaceVariant: '#43474d',
  outlineVariant: '#c3c7cd',
}

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
  voiceProfiles?: Array<{ id: string; name: string; isDefault: boolean; isCloned: boolean }>
  relationships?: Array<{
    id: string
    type: 'PARENT' | 'CHILD' | 'SPOUSE'
    person: { id: string; firstName: string; lastName?: string | null }
  }>
}

interface Story {
  id: string
  title: string
  excerpt?: string | null
  storyDate?: string | null
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

const WAVEFORM_HEIGHTS = [8, 12, 16, 20, 24, 16, 20, 12, 8, 14, 10, 18, 22, 14, 10]

export default function PersonProfilePage() {
  const router = useRouter()
  const { id } = router.query
  const personId = typeof id === 'string' ? id : ''
  const { selectedFamilyMember } = useSelectedFamilyMember()

  // When the active member changes via the header switcher, navigate to their profile
  useEffect(() => {
    if (selectedFamilyMember && selectedFamilyMember.id !== personId && personId) {
      router.push(`/profile/${selectedFamilyMember.id}`)
    }
  }, [selectedFamilyMember?.id])

  const [person, setPerson] = useState<PersonDetails | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [documents, setDocuments] = useState<DocItem[]>([])
  const [docTotal, setDocTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const timelineRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragScrollLeft, setDragScrollLeft] = useState(0)
  const [hasDragged, setHasDragged] = useState(false)

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
          <CircularProgress sx={{ color: C.primary }} />
        </Box>
      </Layout>
    )
  }

  if (!person) {
    return (
      <Layout>
        <Box sx={{ maxWidth: 600, mx: 'auto', px: 4, py: 12, textAlign: 'center' }}>
          <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '2.5rem', color: C.primary }}>
            Profile not found
          </Typography>
        </Box>
      </Layout>
    )
  }

  const name = fullName(person)
  const birthYear = toYear(person.birthDate)
  const deathYear = toYear(person.deathDate)

  const spouse = person.relationships?.find(r => r.type === 'SPOUSE') ?? null
  const parents = person.relationships?.filter(r => r.type === 'PARENT') ?? []
  const children = person.relationships?.filter(r => r.type === 'CHILD') ?? []

  const defaultVoice = person.voiceProfiles?.find(v => v.isDefault) ?? person.voiceProfiles?.[0] ?? null
  const hasClonedVoice = !!defaultVoice?.isCloned

  const sortedStories = [...stories].sort((a, b) => {
    if (!a.storyDate && !b.storyDate) return 0
    if (!a.storyDate) return 1
    if (!b.storyDate) return -1
    return new Date(a.storyDate).getTime() - new Date(b.storyDate).getTime()
  })

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
        <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 3, md: 6 }, pt: { xs: 4, md: 8 }, pb: 20, bgcolor: C.surface, minHeight: '100vh' }}>

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
              <Box
                sx={{
                  width: { xs: 150, md: 190 },
                  height: { xs: 150, md: 190 },
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '7px solid #fff',
                  boxShadow: '0 10px 40px rgba(28,28,25,0.08)',
                  bgcolor: C.surfaceContainerHigh,
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
                  <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '4.5rem', color: C.primary, fontWeight: 700, lineHeight: 1 }}>
                    {person.firstName?.[0] ?? '?'}
                  </Typography>
                )}
              </Box>
              {(birthYear || deathYear) && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: -10,
                    right: -10,
                    bgcolor: C.primary,
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
                  color: C.primary,
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
                    color: C.onSurfaceVariant,
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
                    color: C.onSurfaceVariant,
                    lineHeight: 1.7,
                    mt: 2.5,
                    maxWidth: 560,
                    mx: { xs: 'auto', md: 0 },
                  }}
                >
                  {person.bio}
                </Typography>
              )}

              {/* Action buttons */}
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 3.5, justifyContent: { xs: 'center', md: 'flex-start' } }}>
                <Box
                  component={Link}
                  href={`/voice-lab?personId=${personId}`}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 3.5,
                    py: 1.25,
                    background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryContainer} 100%)`,
                    color: '#fff',
                    borderRadius: '9999px',
                    fontFamily: 'var(--font-manrope), sans-serif',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    textDecoration: 'none',
                    boxShadow: '0 4px 18px rgba(22,51,74,0.28)',
                    transition: 'opacity 0.2s',
                    '&:hover': { opacity: 0.88 },
                  }}
                >
                  <span style={{ fontFamily: '"Material Symbols Outlined"', fontSize: 20, lineHeight: 1 }}>settings_voice</span>
                  Listen to {person.firstName}
                </Box>
                <Box
                  component={Link}
                  href={`/family-tree?personId=${personId}`}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: 3.5,
                    py: 1.25,
                    bgcolor: C.secondaryContainer,
                    color: C.onSecondaryContainer,
                    borderRadius: '9999px',
                    fontFamily: 'var(--font-manrope), sans-serif',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    textDecoration: 'none',
                    transition: 'background 0.2s',
                    '&:hover': { bgcolor: '#b7cacd' },
                  }}
                >
                  Family Tree
                </Box>
              </Box>
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
            {/* Voice Signature card */}
            <Box
              sx={{
                gridColumn: { xs: '1', md: '1 / 9' },
                bgcolor: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(24px)',
                borderRadius: '2rem',
                p: { xs: 3, md: 4.5 },
                boxShadow: '0 10px 40px rgba(28,28,25,0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: 380,
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
                  <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '1.875rem', fontWeight: 700, color: C.primary }}>
                    Voice Signature
                  </Typography>
                  {hasClonedVoice ? (
                    <Box sx={{ bgcolor: C.tertiaryFixed, color: C.onTertiaryFixedVariant, px: 2, py: 0.5, borderRadius: '9999px', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-manrope), sans-serif' }}>
                      Verified AI Clone
                    </Box>
                  ) : person.voiceProfiles && person.voiceProfiles.length > 0 ? (
                    <Box sx={{ bgcolor: C.secondaryContainer, color: C.onSecondaryContainer, px: 2, py: 0.5, borderRadius: '9999px', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-manrope), sans-serif' }}>
                      Voice Profile
                    </Box>
                  ) : null}
                </Box>

                {/* Waveform */}
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: 88, mb: 4 }}>
                  {WAVEFORM_HEIGHTS.map((h, i) => (
                    <Box
                      key={i}
                      sx={{
                        flex: 1,
                        height: h * 3.5,
                        borderRadius: '9999px',
                        bgcolor: i >= 2 && i <= 6 ? C.primary : C.tertiaryFixedDim,
                      }}
                    />
                  ))}
                </Box>

                {/* Controls */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                  <IconButton sx={{ color: C.primary, opacity: 0.35 }} aria-label="Replay 10 seconds">
                    <Replay10 sx={{ fontSize: 28 }} />
                  </IconButton>
                  <Box
                    component={Link}
                    href={`/voice-lab?personId=${personId}`}
                    sx={{
                      width: 60,
                      height: 60,
                      bgcolor: C.primary,
                      color: '#fff',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textDecoration: 'none',
                      boxShadow: '0 6px 24px rgba(22,51,74,0.3)',
                      transition: 'transform 0.15s, opacity 0.15s',
                      '&:hover': { opacity: 0.9 },
                      '&:active': { transform: 'scale(0.92)' },
                    }}
                    aria-label="Play voice sample"
                  >
                    <PlayArrow sx={{ fontSize: 34 }} />
                  </Box>
                  <IconButton sx={{ color: C.primary, opacity: 0.35 }} aria-label="Forward 30 seconds">
                    <Forward30 sx={{ fontSize: 28 }} />
                  </IconButton>
                </Box>
              </Box>

              {/* Quote from bio */}
              <Box sx={{ mt: 4 }}>
                {person.bio ? (
                  <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontStyle: 'italic', fontSize: '1.05rem', color: C.primary, textAlign: 'center', lineHeight: 1.6 }}>
                    &ldquo;{person.bio.length > 130 ? person.bio.substring(0, 130).trimEnd() + '\u2026' : person.bio}&rdquo;
                  </Typography>
                ) : (
                  <Box sx={{ textAlign: 'center' }}>
                    <Box
                      component={Link}
                      href={`/voice-lab?personId=${personId}`}
                      sx={{ fontFamily: 'var(--font-manrope), sans-serif', fontSize: '0.85rem', color: C.onSurfaceVariant, textDecoration: 'none', borderBottom: `1px solid ${C.outlineVariant}`, pb: 0.25, '&:hover': { color: C.primary } }}
                    >
                      + Create Voice Profile in Voice Lab
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Family Tree card */}
            <Box
              sx={{
                gridColumn: { xs: '1', md: '9 / 13' },
                bgcolor: C.surfaceContainerLow,
                borderRadius: '2rem',
                p: { xs: 3, md: 4 },
                display: 'flex',
                flexDirection: 'column',
                minHeight: 380,
              }}
            >
              <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '1.5rem', fontWeight: 700, color: C.primary, mb: 3 }}>
                Family Tree
              </Typography>

              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                {/* Spouse or parents row */}
                {(spouse || parents.length > 0) && (
                  <>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {spouse && (
                        <Box component={Link} href={`/profile/${spouse.person.id}`} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, textDecoration: 'none' }}>
                          <Avatar sx={{ width: 54, height: 54, bgcolor: '#adcae6', border: `2px solid ${C.primaryContainer}`, transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.06)' } }}>
                            {spouse.person.firstName[0]}
                          </Avatar>
                          <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.onSurfaceVariant }}>
                            {spouse.person.firstName}
                          </Typography>
                        </Box>
                      )}
                      {parents.slice(0, 2).map(r => (
                        <Box key={r.id} component={Link} href={`/profile/${r.person.id}`} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, textDecoration: 'none' }}>
                          <Avatar sx={{ width: 54, height: 54, bgcolor: '#adcae6', border: `2px solid ${C.primaryContainer}`, transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.06)' } }}>
                            {r.person.firstName[0]}
                          </Avatar>
                          <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.onSurfaceVariant }}>
                            {r.person.firstName}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                    <Box sx={{ width: 1, height: 28, bgcolor: `${C.outlineVariant}35` }} />
                  </>
                )}

                {/* Current person */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
                  <Box
                    sx={{
                      width: 68,
                      height: 68,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: `4px solid ${C.primary}`,
                      boxShadow: '0 4px 18px rgba(22,51,74,0.22)',
                      bgcolor: C.surfaceContainerHigh,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {person.avatarUrl ? (
                      <Box component="img" src={person.avatarUrl} alt={name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '1.6rem', color: C.primary, fontWeight: 700, lineHeight: 1 }}>
                        {person.firstName[0]}
                      </Typography>
                    )}
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {person.firstName}
                  </Typography>
                </Box>

                {/* Children */}
                {children.length > 0 && (
                  <>
                    <Box sx={{ width: 1, height: 28, bgcolor: `${C.outlineVariant}35` }} />
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {children.slice(0, 3).map(r => (
                        <Box key={r.id} component={Link} href={`/profile/${r.person.id}`} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, textDecoration: 'none' }}>
                          <Avatar sx={{ width: 42, height: 42, bgcolor: '#d3e6e9', transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.06)' } }}>
                            {r.person.firstName[0]}
                          </Avatar>
                          <Typography sx={{ fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: C.onSurfaceVariant }}>
                            {r.person.firstName}
                          </Typography>
                        </Box>
                      ))}
                      {children.length > 3 && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
                          <Avatar sx={{ width: 42, height: 42, bgcolor: C.surfaceContainerHigh, color: C.onSurfaceVariant, fontSize: '0.72rem', fontWeight: 700 }}>
                            +{children.length - 3}
                          </Avatar>
                          <Typography sx={{ fontSize: '0.58rem', textTransform: 'uppercase', color: C.onSurfaceVariant }}>more</Typography>
                        </Box>
                      )}
                    </Box>
                  </>
                )}

                {parents.length === 0 && !spouse && children.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <Typography sx={{ color: C.onSurfaceVariant, fontSize: '0.875rem', fontFamily: 'var(--font-manrope), sans-serif' }}>
                      No family connections yet.
                    </Typography>
                  </Box>
                )}

                <Box
                  component={Link}
                  href={`/family-tree?personId=${personId}`}
                  sx={{ mt: 2.5, fontSize: '0.75rem', color: C.onSurfaceVariant, textDecoration: 'none', fontFamily: 'var(--font-manrope), sans-serif', borderBottom: `1px solid ${C.outlineVariant}50`, pb: 0.25, '&:hover': { color: C.primary } }}
                >
                  View full family tree →
                </Box>
              </Box>
            </Box>
          </Box>

          {/* ─── The Narrative ─── */}
          <Box component="section" sx={{ mb: { xs: 8, md: 14 }, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 5 }}>
              <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: { xs: '2rem', md: '2.625rem' }, fontWeight: 700, color: C.primary, whiteSpace: 'nowrap' }}>
                The Narrative
              </Typography>
              <Box sx={{ flex: 1, height: 1, bgcolor: `${C.outlineVariant}25` }} />
              <Typography sx={{ fontFamily: 'var(--font-manrope), sans-serif', fontSize: '0.72rem', color: C.onSurfaceVariant, opacity: 0.6, userSelect: 'none' }}>
                drag to explore
              </Typography>
            </Box>

            {sortedStories.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography sx={{ color: C.onSurfaceVariant, fontFamily: 'var(--font-newsreader), serif', fontSize: '1.25rem', fontStyle: 'italic' }}>
                  No stories have been recorded yet.
                </Typography>
                <Box
                  component={Link}
                  href={`/stories?subjectId=${personId}`}
                  sx={{ display: 'inline-block', mt: 2, color: C.primary, textDecoration: 'none', fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 600, fontSize: '0.9rem', borderBottom: `2px solid ${C.primary}35`, pb: 0.25 }}
                >
                  Begin the narrative →
                </Box>
              </Box>
            ) : (
              <Box sx={{ position: 'relative' }}>
                <Box sx={{ position: 'absolute', top: 310, left: 0, right: 0, height: 2, background: `linear-gradient(to right, transparent, ${C.outlineVariant}30, transparent)`, zIndex: 0 }} />
                <Box
                  ref={timelineRef}
                  onMouseDown={onDragStart}
                  onMouseMove={onDragMove}
                  onMouseUp={onDragEnd}
                  onMouseLeave={onDragEnd}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onDragEnd}
                  sx={{
                    display: 'flex',
                    gap: { xs: 3, md: 4 },
                    overflowX: 'auto',
                    pb: 5,
                    pt: 2,
                    px: 0.5,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    '&::-webkit-scrollbar': { display: 'none' },
                    msOverflowStyle: 'none',
                    scrollbarWidth: 'none',
                  }}
                >
                  {sortedStories.map(story => {
                    const year = toYear(story.storyDate)
                    return (
                      <Box
                        key={story.id}
                        component={Link}
                        href={`/stories/${story.id}`}
                        onClick={(e: React.MouseEvent) => { if (hasDragged) e.preventDefault() }}
                        sx={{ flexShrink: 0, width: { xs: 240, md: 300 }, textDecoration: 'none', position: 'relative', '&:hover .story-card': { transform: 'translateY(-7px)' } }}
                      >
                        <Box
                          className="story-card"
                          sx={{
                            position: 'relative',
                            zIndex: 1,
                            aspectRatio: '3/4',
                            borderRadius: '2rem',
                            overflow: 'hidden',
                            background: `linear-gradient(160deg, ${C.surfaceContainer} 0%, ${C.surfaceContainerLow} 100%)`,
                            boxShadow: '0 8px 32px rgba(28,28,25,0.09)',
                            transition: 'transform 0.4s ease',
                          }}
                        >
                          {year && (
                            <Typography
                              sx={{
                                position: 'absolute',
                                top: 20,
                                left: 22,
                                fontFamily: 'var(--font-newsreader), serif',
                                fontSize: { xs: '2.75rem', md: '3.25rem' },
                                fontWeight: 700,
                                color: 'rgba(22,51,74,0.45)',
                                lineHeight: 1,
                              }}
                            >
                              {year}
                            </Typography>
                          )}
                        </Box>

                        {/* Timeline dot */}
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 66,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            bgcolor: C.primary,
                            border: `3px solid ${C.surface}`,
                            outline: `2px solid ${C.primary}28`,
                            zIndex: 10,
                          }}
                        />

                        <Box sx={{ pt: 3.5 }}>
                          <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '1.2rem', fontWeight: 600, color: C.primary }}>
                            {story.title}
                          </Typography>
                          {story.excerpt && (
                            <Typography
                              sx={{
                                fontFamily: 'var(--font-manrope), sans-serif',
                                fontSize: '0.82rem',
                                color: C.onSurfaceVariant,
                                mt: 0.75,
                                lineHeight: 1.6,
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {story.excerpt}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    )
                  })}

                  {/* Add chapter placeholder */}
                  <Box component={Link} href={`/stories?subjectId=${personId}`} sx={{ flexShrink: 0, width: { xs: 240, md: 300 }, textDecoration: 'none' }}>
                    <Box
                      sx={{
                        aspectRatio: '3/4',
                        borderRadius: '2rem',
                        border: `2px dashed ${C.outlineVariant}50`,
                        bgcolor: C.surfaceContainerLow,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: 1.5,
                        transition: 'border-color 0.2s, background 0.2s',
                        '&:hover': { borderColor: `${C.primary}60`, bgcolor: C.surfaceContainerLowest },
                      }}
                    >
                      <span style={{ fontFamily: '"Material Symbols Outlined"', fontSize: 32, color: C.onSurfaceVariant, opacity: 0.35 }}>add</span>
                      <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '1rem', fontStyle: 'italic', color: C.onSurfaceVariant }}>
                        Add a chapter
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>

          {/* ─── The Archive Box ─── */}
          <Box component="section">
            <Box sx={{ bgcolor: C.surfaceContainerLow, borderRadius: '3rem', p: { xs: 3, md: 6 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 5, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: { xs: '2rem', md: '2.5rem' }, fontWeight: 700, color: C.primary }}>
                    The Archive Box
                  </Typography>
                  <Typography sx={{ fontFamily: 'var(--font-manrope), sans-serif', fontSize: '0.875rem', color: C.onSurfaceVariant, mt: 0.5 }}>
                    Scanned letters, blueprints, and physical memories.
                  </Typography>
                </Box>
                {docTotal > 4 && (
                  <Box
                    component={Link}
                    href={`/documents?personId=${personId}`}
                    sx={{ color: C.primary, textDecoration: 'none', fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: `2px solid ${C.primary}30`, pb: 0.25, transition: 'border-color 0.2s', '&:hover': { borderColor: C.primary } }}
                  >
                    View All {docTotal} Items
                  </Box>
                )}
              </Box>

              {documents.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <Typography sx={{ color: C.onSurfaceVariant, fontFamily: 'var(--font-newsreader), serif', fontSize: '1.1rem', fontStyle: 'italic' }}>
                    No documents archived yet.
                  </Typography>
                  <Box
                    component={Link}
                    href={`/documents?personId=${personId}`}
                    sx={{ display: 'inline-block', mt: 2, color: C.primary, textDecoration: 'none', fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 600, fontSize: '0.9rem', borderBottom: `2px solid ${C.primary}35`, pb: 0.25 }}
                  >
                    Upload documents →
                  </Box>
                </Box>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: { xs: 2, md: 3 } }}>
                  {documents.map(doc => (
                    <Box
                      key={doc.id}
                      component={Link}
                      href={`/documents/${doc.id}`}
                      sx={{
                        position: 'relative',
                        aspectRatio: '1',
                        bgcolor: C.surfaceContainerLowest,
                        borderRadius: '1rem',
                        overflow: 'hidden',
                        boxShadow: '0 2px 10px rgba(28,28,25,0.05)',
                        textDecoration: 'none',
                        cursor: 'zoom-in',
                        transition: 'box-shadow 0.3s',
                        '&:hover .doc-img': { transform: 'scale(1.08)', opacity: 1 },
                        '&:hover .doc-overlay': { opacity: 1 },
                        '&:hover': { boxShadow: '0 8px 32px rgba(28,28,25,0.14)' },
                      }}
                    >
                      {doc.asset?.id ? (
                        <Box
                          className="doc-img"
                          component="img"
                          src={`/api/assets/serve/${doc.asset.id}`}
                          alt={doc.title}
                          sx={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.83, transition: 'transform 0.4s ease, opacity 0.3s ease' }}
                        />
                      ) : (
                        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: C.surfaceContainer }}>
                          <span style={{ fontFamily: '"Material Symbols Outlined"', fontSize: 38, color: C.onSurfaceVariant, opacity: 0.45 }}>
                            {doc.documentType === 'PHOTO' ? 'photo' : doc.documentType === 'LETTER' ? 'mail' : 'description'}
                          </span>
                        </Box>
                      )}
                      <Box
                        className="doc-overlay"
                        sx={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          p: 1.5,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.62), transparent)',
                          opacity: 0,
                          transition: 'opacity 0.3s ease',
                        }}
                      >
                        <Typography sx={{ color: '#fff', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-manrope), sans-serif' }}>
                          {doc.title.length > 26 ? doc.title.substring(0, 26) + '\u2026' : doc.title}
                          {doc.dateOccurred && `, ${new Date(doc.dateOccurred).getFullYear()}`}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>

        </Box>
      </Layout>
    </>
  )
}
