import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { TalkPage } from '@/components/pages/TalkPage'
import { LegacySubject } from '@/types'
import { useEffect, useState, useMemo } from 'react'
import { Box, CircularProgress, Typography, Card, FormControl, InputLabel, MenuItem, Select } from '@mui/material'
import { useRouter } from 'next/router'
import { SearchableFamilyMember } from '@/components/search'

interface PersonOption {
  id: string
  firstName: string
  lastName?: string
  displayName?: string
  avatarUrl?: string
}

const personName = (person: PersonOption) => {
  return person.displayName || `${person.firstName}${person.lastName ? ` ${person.lastName}` : ''}`
}

export default function Talk() {
  const router = useRouter()
  const selectedSubjectId = typeof router.query.subjectId === 'string' ? router.query.subjectId : undefined
  const [people, setPeople] = useState<PersonOption[]>([])
  const [legacySubject, setLegacySubject] = useState<LegacySubject | null>(null)

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

  const selectedPersonLabel = useMemo(() => {
    if (!selectedSubjectId) return null
    return people.find((person) => person.id === selectedSubjectId) || null
  }, [people, selectedSubjectId])

  // Convert people to SearchableFamilyMember format for the search component
  const searchablePeople = useMemo<SearchableFamilyMember[]>(() => {
    return people.map((person) => ({
      id: person.id,
      name: personName(person),
      avatar: person.avatarUrl || '',
      subtitle: 'Family Member',
    }))
  }, [people])

  const handleSubjectChange = async (value: string) => {
    if (!value) {
      await router.push('/talk')
      return
    }

    await router.push(`/talk?subjectId=${encodeURIComponent(value)}`)
  }

  useEffect(() => {
    // Fetch the selected person or first person as the legacy subject
    async function fetchSubject() {
      try {
        let personId = selectedSubjectId
        
        // If no person selected, get the first person
        if (!personId) {
          const peopleRes = await fetch('/api/people?limit=1', { credentials: 'include' })
          const peopleData = await peopleRes.json()
          if (peopleData.success && peopleData.data?.length > 0) {
            personId = peopleData.data[0].id
          }
        }

        if (personId) {
          // Get the specific person
          const res = await fetch(`/api/people/${personId}`, { credentials: 'include' })
          const data = await res.json()
          if (data.success && data.data) {
            const p = data.data
            setLegacySubject({
              id: p.id,
              fullName: p.displayName || `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`,
              lifespanText: p.isDeceased ? 'In Loving Memory' : 'Living Legacy',
              bio: p.bio || '',
              avatarUrl: p.avatarUrl || '',
              accentIcon: 'heart',
            })
            return
          }
        }
        
        // Fallback if no people exist or selected person not found
        setLegacySubject({
          id: 'default',
          fullName: 'Your Legacy',
          lifespanText: '',
          bio: '',
          avatarUrl: '',
          accentIcon: 'heart',
        })
      } catch {
        setLegacySubject({
          id: 'default',
          fullName: 'Your Legacy',
          lifespanText: '',
          bio: '',
          avatarUrl: '',
          accentIcon: 'heart',
        })
      }
    }
    
    if (people.length > 0 || selectedSubjectId) {
      fetchSubject()
    } else {
      // Wait for people to load
      const checkPeople = setInterval(() => {
        if (people.length > 0) {
          clearInterval(checkPeople)
          fetchSubject()
        }
      }, 100)
      
      return () => clearInterval(checkPeople)
    }
  }, [selectedSubjectId, people])

  if (!legacySubject) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <>
      <Head>
        <title>Talk - Heard Again</title>
        <meta name="description" content={`Conversation with ${legacySubject.fullName}`} />
      </Head>
      <Layout>
        <Box sx={{ px: { xs: 2, md: 4 }, pt: 3 }}>
          <Card sx={{ p: 2, borderRadius: 3, bgcolor: '#f6f3ee' }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h6" sx={{ color: '#16334a', fontFamily: 'var(--font-newsreader), serif' }}>
                  {selectedPersonLabel
                    ? `Talk with ${personName(selectedPersonLabel)}`
                    : 'Family Archive: Random Voice Selection'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#546669' }}>
                  {selectedPersonLabel
                    ? 'Having a conversation with the selected family member.'
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
        <TalkPage legacySubject={legacySubject} subjectId={selectedSubjectId} availablePeople={searchablePeople} />
      </Layout>
    </>
  )
}
