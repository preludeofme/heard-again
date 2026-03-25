import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { Avatar, Box, Button, Card, Chip, CircularProgress, MenuItem, Select, Stack, Typography } from '@mui/material'
import { Layout } from '@/components/layout/Layout'

interface PersonSummary {
  id: string
  firstName: string
  lastName?: string
  displayName?: string
}

interface PersonDetails {
  id: string
  firstName: string
  lastName?: string
  displayName?: string
  birthDate?: string | null
  deathDate?: string | null
  bio?: string | null
  avatarUrl?: string | null
  relationships?: Array<{ type: 'PARENT' | 'CHILD' | 'SPOUSE'; person: { id: string; firstName: string; lastName?: string | null } }>
}

interface StoryPreview {
  id: string
  title: string
  excerpt?: string | null
}

const fullName = (p: { firstName?: string; lastName?: string | null; displayName?: string | null }) =>
  p.displayName || `${p.firstName || ''}${p.lastName ? ` ${p.lastName}` : ''}`.trim() || 'Unnamed Person'

export default function PersonProfilePage() {
  const router = useRouter()
  const { id } = router.query
  const personId = typeof id === 'string' ? id : ''
  const [people, setPeople] = useState<PersonSummary[]>([])
  const [person, setPerson] = useState<PersonDetails | null>(null)
  const [stories, setStories] = useState<StoryPreview[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!personId) return
    let active = true

    const load = async () => {
      setIsLoading(true)
      try {
        const [personRes, peopleRes, storiesRes] = await Promise.all([
          fetch(`/api/people/${personId}`),
          fetch('/api/people'),
          fetch(`/api/stories?subjectId=${personId}&limit=3`),
        ])
        const [personData, peopleData, storiesData] = await Promise.all([personRes.json(), peopleRes.json(), storiesRes.json()])
        if (!active) return
        if (personData.success) setPerson(personData.data)
        if (peopleData.success) setPeople(peopleData.data || [])
        if (storiesData.success) setStories(storiesData.data?.stories || [])
      } finally {
        if (active) setIsLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [personId])

  const parents = useMemo(() => (person?.relationships || []).filter((r) => r.type === 'PARENT'), [person?.relationships])
  const children = useMemo(() => (person?.relationships || []).filter((r) => r.type === 'CHILD'), [person?.relationships])

  if (isLoading) {
    return <Layout><Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box></Layout>
  }

  return (
    <>
      <Head><title>{person ? `${fullName(person)} | Profile` : 'Profile'} | Heard Again</title></Head>
      <Layout>
        <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, md: 4 }, py: 4 }}>
          <Card sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, bgcolor: '#f6f3ee' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', md: 'center' }}>
              <Box sx={{ p: 0.75, bgcolor: '#fff', borderRadius: 3, transform: 'rotate(-4deg)', transition: 'transform 0.2s ease', '&:hover': { transform: 'rotate(-1deg) translateY(-2px)' } }}>
                <Avatar src={person?.avatarUrl || undefined} sx={{ width: 96, height: 96, bgcolor: '#d0e3e6', fontSize: '2rem' }}>{person?.firstName?.[0] || '?'}</Avatar>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" sx={{ color: '#16334a', fontFamily: 'var(--font-newsreader), serif' }}>{person ? fullName(person) : 'Profile not found'}</Typography>
                <Typography variant="body2" sx={{ color: '#546669', mt: 0.5 }}>
                  {person?.birthDate ? `Born ${new Date(person.birthDate).toLocaleDateString()}` : 'Birth date unknown'}{person?.deathDate ? ` • Died ${new Date(person.deathDate).toLocaleDateString()}` : ''}
                </Typography>
                <Typography variant="body1" sx={{ mt: 1.5, color: '#1c1c19' }}>{person?.bio || 'No biography yet.'}</Typography>
              </Box>
              <Select
                size="small"
                value={personId}
                onChange={(event) => router.push(`/profile/${event.target.value}`)}
                sx={{ minWidth: 220, bgcolor: '#fff', borderRadius: 2 }}
              >
                {people.map((member) => <MenuItem key={member.id} value={member.id}>{fullName(member)}</MenuItem>)}
              </Select>
            </Stack>
          </Card>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
            <Button component={Link} href={`/stories?subjectId=${personId}`} variant="contained">View Stories</Button>
            <Button component={Link} href={`/voice-lab?personId=${personId}`} variant="outlined">Open Voice Lab</Button>
            <Button component={Link} href={`/talk?personId=${personId}`} variant="outlined">Open Talk</Button>
            <Button component={Link} href={`/family-tree?personId=${personId}`} variant="text">Open Full Family Tree</Button>
          </Stack>

          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ mt: 2 }}>
            <Card sx={{ flex: 1, p: 2.5, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ color: '#16334a', mb: 1.5 }}>Stories Preview</Typography>
              {stories.length === 0 ? <Typography variant="body2" sx={{ color: '#546669' }}>No stories yet for this person.</Typography> : (
                <Stack spacing={1.5}>{stories.map((story) => (
                  <Box key={story.id}>
                    <Typography variant="subtitle2" sx={{ color: '#16334a' }}>{story.title}</Typography>
                    <Typography variant="body2" sx={{ color: '#546669' }}>{story.excerpt || 'No excerpt available.'}</Typography>
                  </Box>
                ))}</Stack>
              )}
            </Card>

            <Card sx={{ flex: 1, p: 2.5, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ color: '#16334a', mb: 1.5 }}>Family Tree Preview</Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25 }}>
                <Typography variant="caption" sx={{ color: '#546669' }}>Parents</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                  {parents.length > 0 ? (
                    parents.map((r) => <Chip key={`${r.type}-${r.person.id}`} label={fullName(r.person)} size="small" />)
                  ) : (
                    <Chip label="No parents listed" size="small" variant="outlined" />
                  )}
                </Stack>

                <Box sx={{ width: 2, height: 18, bgcolor: 'rgba(22, 51, 74, 0.3)', borderRadius: 2 }} />

                <Chip
                  label={person ? fullName(person) : 'Selected Person'}
                  size="medium"
                  sx={{ bgcolor: 'rgba(22, 51, 74, 0.12)', color: '#16334a', fontWeight: 700 }}
                />

                <Box sx={{ width: 2, height: 18, bgcolor: 'rgba(22, 51, 74, 0.3)', borderRadius: 2 }} />

                <Typography variant="caption" sx={{ color: '#546669' }}>Children</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                  {children.length > 0 ? (
                    children.map((r) => <Chip key={`${r.type}-${r.person.id}`} label={fullName(r.person)} size="small" />)
                  ) : (
                    <Chip label="No children listed" size="small" variant="outlined" />
                  )}
                </Stack>

                <Button component={Link} href={`/family-tree?personId=${personId}`} size="small" sx={{ mt: 1, textTransform: 'none' }}>
                  Open full family tree
                </Button>
              </Box>
            </Card>
          </Stack>
        </Box>
      </Layout>
    </>
  )
}
