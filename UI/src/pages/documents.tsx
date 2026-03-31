import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { DocumentsPage } from '@/components/pages/DocumentsPage'
import { useDocumentsController } from '@/controllers/useDocumentsController'
import { Box, CircularProgress, Typography, Button, Card, FormControl, InputLabel, MenuItem, Select } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'

interface PersonOption {
  id: string
  firstName: string
  lastName?: string
  displayName?: string
}

const personName = (person: PersonOption) => {
  return person.displayName || `${person.firstName}${person.lastName ? ` ${person.lastName}` : ''}`
}

export default function Documents() {
  const { selectedFamilyMember, setSelectedFamilyMember, clearSelectedFamilyMember } = useSelectedFamilyMember()
  const selectedSubjectId = selectedFamilyMember?.id
  const controller = useDocumentsController(selectedSubjectId)
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
      })
    }
  }

  return (
    <>
      <Head>
        <title>Documents - Heard Again</title>
        <meta name="description" content="Document Archive" />
      </Head>
      <Layout>
        <Box sx={{ px: { xs: 2, md: 4 }, pt: 3 }}>
          <Card sx={{ p: 2, borderRadius: 3, bgcolor: '#f6f3ee' }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h6" sx={{ color: '#16334a', fontFamily: 'var(--font-newsreader), serif' }}>
                  {selectedPersonLabel
                    ? `Documents for ${personName(selectedPersonLabel)}`
                    : 'Family Archive: All Documents'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#546669' }}>
                  {selectedPersonLabel
                    ? 'Showing documents tied to the selected family member.'
                    : 'No family member selected — showing all family documents.'}
                </Typography>
              </Box>

              <FormControl size="small" sx={{ minWidth: 260, bgcolor: '#fff', borderRadius: 2 }}>
                <InputLabel>Family Member</InputLabel>
                <Select
                  label="Family Member"
                  value={selectedSubjectId || ''}
                  onChange={(event) => handleSubjectChange(event.target.value)}
                >
                  <MenuItem value="">All family documents</MenuItem>
                  {people.map((person) => (
                    <MenuItem key={person.id} value={person.id}>{personName(person)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
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
            <Button variant="contained" onClick={controller.refreshDocuments}>Retry</Button>
          </Box>
        ) : (
          <DocumentsPage documents={controller.documents} />
        )}
      </Layout>
    </>
  )
}
