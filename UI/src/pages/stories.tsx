import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { StoriesPage } from '@/components/pages/StoriesPage'
import { useStoriesController } from '@/controllers/useStoriesController'
import { Box, CircularProgress, Typography, Button, Card, TextField } from '@mui/material'
import Autocomplete from '@mui/material/Autocomplete'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { StoryContribution } from '@/types'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'

interface PersonOption {
  id: string
  firstName: string
  lastName?: string
  displayName?: string
  avatarUrl?: string | null
}

const personName = (person: PersonOption) => {
  return person.displayName || `${person.firstName}${person.lastName ? ` ${person.lastName}` : ''}`
}

export default function Stories() {
  const router = useRouter()
  const { selectedFamilyMember, setSelectedFamilyMember, clearSelectedFamilyMember } = useSelectedFamilyMember()
  const selectedSubjectId = selectedFamilyMember?.id
  const controller = useStoriesController(selectedSubjectId)
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
    return () => {
      active = false
    }
  }, [])

  const visibleStories = useMemo<StoryContribution[]>(() => {
    if (selectedSubjectId) {
      return controller.stories
    }

    const shuffled = [...controller.stories].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 6)
  }, [controller.stories, selectedSubjectId])

  const selectedPersonLabel = useMemo(() => {
    if (!selectedSubjectId) return null
    return people.find((person) => person.id === selectedSubjectId) || null
  }, [people, selectedSubjectId])

  const handleSubjectChange = async (value: string) => {
    if (!value) {
      clearSelectedFamilyMember()
      return
    }

    const selectedPerson = people.find((person) => person.id === value)
    if (selectedPerson) {
      setSelectedFamilyMember({
        id: selectedPerson.id,
        firstName: selectedPerson.firstName,
        lastName: selectedPerson.lastName,
        displayName: selectedPerson.displayName,
        avatarUrl: selectedPerson.avatarUrl,
      })
    }
  }

  return (
    <>
      <Head>
        <title>Stories - Heard Again</title>
        <meta name="description" content="Help us tell their story" />
      </Head>
      <Layout>
        <Box sx={{ px: { xs: 2, md: 4 }, pt: 3 }}>
          <Card sx={{ p: 2, borderRadius: 3, bgcolor: '#f6f3ee' }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h6" sx={{ color: '#16334a', fontFamily: 'var(--font-newsreader), serif' }}>
                  {selectedPersonLabel
                    ? `Stories for ${personName(selectedPersonLabel)}`
                    : 'Family Archive: Random Story Selection'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#546669' }}>
                  {selectedPersonLabel
                    ? 'Showing stories tied to the selected family member.'
                    : 'No family member selected — showing a rotating sample from your family archive.'}
                </Typography>
              </Box>

              <Autocomplete
                size="small"
                options={people}
                getOptionLabel={personName}
                value={selectedPersonLabel}
                onChange={(_, newValue) => handleSubjectChange(newValue?.id ?? '')}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                sx={{ minWidth: 260, bgcolor: '#fff', borderRadius: 2 }}
                renderInput={(params) => (
                  <TextField {...params} label="Family Member" placeholder="Search…" />
                )}
                noOptionsText="No family members found"
                clearText="View full archive"
              />
            </Box>
          </Card>
        </Box>

        {controller.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <CircularProgress />
          </Box>
        ) : controller.hasError ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 2 }}>
            <Typography color="error">{controller.errorMessage}</Typography>
            <Button variant="contained" onClick={controller.refreshStories}>Retry</Button>
          </Box>
        ) : (
          <StoriesPage
            stories={visibleStories}
            selectedFamilyMember={selectedFamilyMember}
            onSubmitStory={async (title, content, storyDate, location, authorRelationship) => {
              await controller.submitStory({
                title,
                content,
                storyType: 'MEMORY',
                subjectId: controller.subjectId,
                storyDate,
                location,
                authorRelationship,
              })
            }}
            onSubmitAudio={async (audioBlob, duration, title, authorRelationship) => {
              await controller.submitAudioStory(audioBlob, duration, title, authorRelationship)
            }}
          />
        )}
      </Layout>
    </>
  )
}
