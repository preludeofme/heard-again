import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { VoiceLabPage } from '@/components/pages/VoiceLabPage'
import { useVoiceLabController } from '@/controllers'
import { Box, CircularProgress, Typography, Button, Card, FormControl, InputLabel, MenuItem, Select } from '@mui/material'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'

interface PersonOption {
  id: string
  firstName: string
  lastName?: string
  displayName?: string
}

const personName = (person: PersonOption) => {
  return person.displayName || `${person.firstName}${person.lastName ? ` ${person.lastName}` : ''}`
}

export default function VoiceLab() {
  const router = useRouter()
  const selectedSubjectId = typeof router.query.subjectId === 'string' ? router.query.subjectId : undefined
  const controller = useVoiceLabController(selectedSubjectId)
  const [people, setPeople] = useState<PersonOption[]>([])

  useEffect(() => {
    let active = true
    const loadPeople = async () => {
      try {
        const res = await fetch('/api/people')
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

  const visibleVoices = useMemo(() => {
    if (selectedSubjectId) {
      return controller.voiceModels
    }

    // Show random selection from all voices when no person is selected
    const shuffled = [...controller.voiceModels].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 6)
  }, [controller.voiceModels, selectedSubjectId])

  const selectedPersonLabel = useMemo(() => {
    if (!selectedSubjectId) return null
    return people.find((person) => person.id === selectedSubjectId) || null
  }, [people, selectedSubjectId])

  const handleSubjectChange = async (value: string) => {
    if (!value) {
      await router.push('/voice-lab')
      return
    }

    await router.push(`/voice-lab?subjectId=${encodeURIComponent(value)}`)
  }

  return (
    <>
      <Head>
        <title>Voice Lab - Heard Again</title>
        <meta name="description" content="Voice & Documents Lab" />
      </Head>
      <Layout>
        <Box sx={{ px: { xs: 2, md: 4 }, pt: 3 }}>
          <Card sx={{ p: 2, borderRadius: 3, bgcolor: '#f6f3ee' }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h6" sx={{ color: '#16334a', fontFamily: 'var(--font-newsreader), serif' }}>
                  {selectedPersonLabel
                    ? `Voices for ${personName(selectedPersonLabel)}`
                    : 'Family Archive: Random Voice Selection'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#546669' }}>
                  {selectedPersonLabel
                    ? 'Showing voice profiles tied to the selected family member.'
                    : 'No family member selected — showing a rotating sample from your family archive.'}
                </Typography>
              </Box>

              <FormControl size="small" sx={{ minWidth: 260, bgcolor: '#fff', borderRadius: 2 }}>
                <InputLabel>Family Member</InputLabel>
                <Select
                  label="Family Member"
                  value={selectedSubjectId || ''}
                  onChange={(event) => handleSubjectChange(event.target.value)}
                >
                  <MenuItem value="">Random family archive</MenuItem>
                  {people.map((person) => (
                    <MenuItem key={person.id} value={person.id}>
                      {personName(person)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Card>
        </Box>
        <VoiceLabPage 
          voiceModels={visibleVoices}
          controller={controller}
        />
      </Layout>
    </>
  )
}
