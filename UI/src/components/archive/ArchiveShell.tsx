import { useMemo, useEffect, useState, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/router'
import { Box, Typography, Avatar, Chip, Button, ToggleButton, ToggleButtonGroup, Skeleton, useMediaQuery, useTheme, TextField } from '@mui/material'
import Autocomplete from '@mui/material/Autocomplete'
import {
  Timeline as JourneyIcon,
  AutoStories as StoriesIcon,
  Description as KeepsakesIcon,
  GraphicEq as VoicesIcon,
  AddCircleOutline as ContributeIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'
import { useDashboardController } from '@/controllers/useDashboardController'

export type ArchiveLens = 'journey' | 'stories' | 'keepsakes' | 'voices'

const VALID_LENSES: readonly ArchiveLens[] = ['journey', 'stories', 'keepsakes', 'voices']

interface PersonOption {
  id: string
  firstName: string
  lastName?: string | null
  displayName?: string | null
  avatarUrl?: string | null
  birthDate?: string | null
  deathDate?: string | null
}

function formatLifespan(birthDate: string | null | undefined, deathDate: string | null | undefined): string | null {
  if (!birthDate && !deathDate) return null
  const birthYear = birthDate ? new Date(birthDate).getFullYear() : null
  const deathYear = deathDate ? new Date(deathDate).getFullYear() : null
  if (birthYear && deathYear) return `${birthYear} – ${deathYear}`
  if (birthYear) return `Born ${birthYear}`
  return null
}

interface ArchiveShellProps {
  lens: ArchiveLens
  onLensChange: (lens: ArchiveLens) => void
  children: ReactNode
}

const personDisplayName = (person: PersonOption): string => {
  return person.displayName || `${person.firstName}${person.lastName ? ` ${person.lastName}` : ''}`
}

const LENS_OPTIONS: Array<{ value: ArchiveLens; label: string; icon: ReactNode }> = [
  { value: 'journey', label: 'Life Journey', icon: <JourneyIcon /> },
  { value: 'stories', label: 'Stories', icon: <StoriesIcon /> },
  { value: 'keepsakes', label: 'Keepsakes', icon: <KeepsakesIcon /> },
  { value: 'voices', label: 'Voices', icon: <VoicesIcon /> },
]

export function isArchiveLens(value: unknown): value is ArchiveLens {
  return typeof value === 'string' && VALID_LENSES.includes(value as ArchiveLens)
}

export function ArchiveShell({ lens, onLensChange, children }: ArchiveShellProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const router = useRouter()
  const { selectedFamilyMember, setSelectedFamilyMember, clearSelectedFamilyMember } = useSelectedFamilyMember()
  const dashboard = useDashboardController()
  const [people, setPeople] = useState<PersonOption[]>([])

  useEffect(() => {
    let active = true
    const loadPeople = async () => {
      try {
        const res = await fetch('/api/people', { credentials: 'include' })
        const data = await res.json()
        if (!active) return
        if (data.success) setPeople(data.data || [])
      } catch {
        if (active) setPeople([])
      }
    }
    loadPeople()
    return () => { active = false }
  }, [])

  const selectedPerson = useMemo(() => {
    if (!selectedFamilyMember?.id) return null
    return people.find((person) => person.id === selectedFamilyMember.id) || null
  }, [people, selectedFamilyMember?.id])

  const handlePersonChange = useCallback((value: string) => {
    if (!value) {
      clearSelectedFamilyMember()
      return
    }
    const person = people.find((p) => p.id === value)
    if (person) {
      setSelectedFamilyMember({
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        displayName: person.displayName,
        avatarUrl: person.avatarUrl,
      })
    }
  }, [people, setSelectedFamilyMember, clearSelectedFamilyMember])

  const familyspaceName = dashboard.familyspace?.name ?? 'Family Story'
  const archiveTitle = selectedPerson
    ? `${personDisplayName(selectedPerson)}'s Story`
    : `${familyspaceName}`
  const subtitle = selectedPerson
    ? 'Memories, voices, and keepsakes preserved across generations.'
    : 'Preserving memories across generations.'

  const stats = dashboard.stats
  const archiveCounts: Array<{ label: string; value: number }> = [
    { label: 'Stories', value: stats.stories },
    { label: 'Voice Memories', value: stats.voiceProfiles },
    { label: 'Keepsakes', value: stats.documents },
    { label: 'Contributors', value: stats.members },
  ]

  const initials = selectedPerson
    ? (selectedPerson.firstName?.[0] || '?').toUpperCase()
    : familyspaceName.slice(0, 1).toUpperCase()

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: ProfileColors.surface }}>
      {/* Archive Hero */}
      <Box
        component="section"
        sx={{
          px: { xs: 3, md: 8 },
          pt: { xs: 5, md: 9 },
          pb: { xs: 4, md: 6 },
          backgroundColor: ProfileColors.surfaceContainerLow,
        }}
      >
        <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 4, md: 6 }, alignItems: { xs: 'flex-start', md: 'center' } }}>
            {/* Avatar / crest */}
            <Box
              sx={{
                width: { xs: 96, md: 128 },
                height: { xs: 96, md: 128 },
                borderRadius: '24px',
                background: 'linear-gradient(135deg, #d0e3e6 0%, #feddb4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {selectedPerson?.avatarUrl ? (
                <Avatar
                  src={selectedPerson.avatarUrl}
                  variant="square"
                  sx={{ width: '100%', height: '100%', '& img': { objectFit: 'cover' } }}
                />
              ) : (
                <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: { xs: '3rem', md: '4rem' }, color: ProfileColors.primary, fontWeight: 700 }}>
                  {initials}
                </Typography>
              )}
            </Box>

            {/* Title block */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-manrope), sans-serif',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: ProfileColors.onSurfaceVariant,
                  mb: 1,
                }}
              >
                The Living Story
              </Typography>
              <Typography
                component="h1"
                sx={{
                  fontFamily: 'var(--font-newsreader), serif',
                  fontSize: { xs: '2.5rem', sm: '3rem', md: '3.5rem' },
                  fontWeight: 700,
                  color: ProfileColors.primary,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.05,
                }}
              >
                {dashboard.isLoading ? <Skeleton width="60%" /> : archiveTitle}
              </Typography>
              {selectedPerson && (() => {
                const lifespan = formatLifespan(selectedPerson.birthDate, selectedPerson.deathDate)
                return lifespan ? (
                  <Typography
                    sx={{
                      fontFamily: 'var(--font-newsreader), serif',
                      fontStyle: 'italic',
                      fontSize: { xs: '1rem', md: '1.1rem' },
                      color: ProfileColors.onSurfaceVariant,
                      mt: 0.5,
                    }}
                  >
                    {lifespan}
                  </Typography>
                ) : null
              })()}
              <Typography
                sx={{
                  fontFamily: 'var(--font-newsreader), serif',
                  fontStyle: 'italic',
                  fontSize: { xs: '1.05rem', md: '1.2rem' },
                  color: ProfileColors.onSurfaceVariant,
                  mt: 1.5,
                }}
              >
                {subtitle}
              </Typography>
            </Box>

            {/* Family member lens selector + quiet Add Memory action */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: { md: 280 } }}>
              <Autocomplete
                size="small"
                options={people}
                getOptionLabel={personDisplayName}
                value={selectedPerson}
                onChange={(_, newValue) => handlePersonChange(newValue?.id ?? '')}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                sx={{ minWidth: 260, bgcolor: ProfileColors.surfaceContainerLowest, borderRadius: 2 }}
                renderInput={(params) => (
                  <TextField {...params} label="Whose story?" placeholder="Everyone" />
                )}
                noOptionsText="No family members yet"
                clearText="View everyone's story"
              />
              <Button
                component={Link}
                href="/contribute"
                variant="outlined"
                size="medium"
                startIcon={<ContributeIcon />}
                sx={{
                  borderColor: ProfileColors.outlineVariant,
                  color: ProfileColors.primary,
                  fontWeight: 600,
                  borderRadius: '999px',
                  py: 1,
                  px: 2.5,
                  textTransform: 'none',
                  fontSize: '0.9rem',
                  '&:hover': {
                    borderColor: ProfileColors.primary,
                    backgroundColor: ProfileColors.surfaceContainerLow,
                  },
                }}
              >
                + Add a Memory
              </Button>
            </Box>
          </Box>

          {/* Archive stats row */}
          <Box
            sx={{
              mt: { xs: 4, md: 6 },
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
              gap: { xs: 2, md: 3 },
            }}
          >
            {archiveCounts.map((stat) => (
              <Box key={stat.label}>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-newsreader), serif',
                    fontSize: { xs: '2rem', md: '2.5rem' },
                    fontWeight: 700,
                    color: ProfileColors.primary,
                    lineHeight: 1.1,
                  }}
                >
                  {dashboard.isLoading ? <Skeleton width={48} /> : stat.value}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-manrope), sans-serif',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: ProfileColors.onSurfaceVariant,
                    mt: 0.5,
                  }}
                >
                  {stat.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Lens switcher */}
      <Box
        component="nav"
        aria-label="Archive view switcher"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          backgroundColor: ProfileColors.surface,
          borderBottom: `1px solid ${ProfileColors.outlineVariant}26`,
          px: { xs: 2, md: 8 },
          py: 2,
        }}
      >
        <Box sx={{ maxWidth: 1280, mx: 'auto', display: 'flex', justifyContent: { xs: 'flex-start', md: 'center' }, overflowX: 'auto' }}>
          <ToggleButtonGroup
            value={lens}
            exclusive
            onChange={(_, value) => {
              if (value && isArchiveLens(value)) onLensChange(value)
            }}
            aria-label="Archive lens"
            sx={{
              gap: 1,
              backgroundColor: ProfileColors.surfaceContainerLow,
              borderRadius: '999px',
              p: 0.5,
              border: 'none',
              '& .MuiToggleButton-root': {
                border: 'none',
                borderRadius: '999px !important',
                px: { xs: 2, md: 3 },
                py: 1.25,
                fontFamily: 'var(--font-manrope), sans-serif',
                fontWeight: 600,
                fontSize: { xs: '0.85rem', md: '0.95rem' },
                textTransform: 'none',
                color: ProfileColors.onSurfaceVariant,
                gap: 1,
                whiteSpace: 'nowrap',
                '&.Mui-selected': {
                  backgroundColor: ProfileColors.surfaceContainerLowest,
                  color: ProfileColors.primary,
                  boxShadow: '0 2px 8px rgba(22, 51, 74, 0.08)',
                  '&:hover': {
                    backgroundColor: ProfileColors.surfaceContainerLowest,
                  },
                },
                '&:hover': {
                  backgroundColor: ProfileColors.surfaceContainerHigh,
                },
              },
            }}
          >
            {LENS_OPTIONS.map((opt) => (
              <ToggleButton key={opt.value} value={opt.value} aria-label={opt.label}>
                {opt.icon}
                {!isMobile && <span>{opt.label}</span>}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Lens content */}
      <Box component="section" aria-live="polite" sx={{ minHeight: '50vh' }}>
        {children}
      </Box>
    </Box>
  )
}
