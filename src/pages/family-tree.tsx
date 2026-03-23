import Head from 'next/head'
import { FamilyTreePage } from '@/components/FamilyTreePage'
import { PersonModal } from '@/components/PersonModal'
import { AddPersonModal, CreatePersonData } from '@/components/AddPersonModal'
import { useEffect, useState, useCallback } from 'react'
import { Box, CircularProgress } from '@mui/material'

interface ApiPerson {
  id: string
  firstName: string
  lastName?: string
  displayName?: string
  avatarUrl?: string
  personType: string
  relationships?: Array<{
    relationshipType: string
    relatedPerson: { id: string; firstName: string; lastName?: string }
  }>
}

function mapPeopleToTree(people: ApiPerson[]) {
  const grandparents: any[] = []
  const parents: any[] = []
  const children: any[] = []

  for (const p of people) {
    const entry = {
      id: p.id,
      name: p.displayName || `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`,
      role: p.personType === 'SUBJECT' ? 'Subject' : 'Family',
      avatar: p.avatarUrl || '',
    }

    // Simple generation assignment based on personType or default to parents
    if (p.personType === 'SUBJECT') {
      parents.push({ ...entry, memories: 0, selected: true })
    } else {
      children.push(entry)
    }
  }

  // If no parents assigned, promote first person
  if (parents.length === 0 && children.length > 0) {
    parents.push({ ...children.shift()!, selected: true })
  }

  return { grandparents, parents, children }
}

export default function FamilyTree() {
  const [treeData, setTreeData] = useState<any>(null)
  const [people, setPeople] = useState<ApiPerson[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Modal states
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false)
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false)

  const fetchPeople = useCallback(async () => {
    try {
      const res = await fetch('/api/people')
      const data = await res.json()
      if (data.success && data.data) {
        setPeople(data.data)
        setTreeData(mapPeopleToTree(data.data))
      }
    } catch {
      // Fall through to render with empty data
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPeople()
  }, [fetchPeople])

  const handlePersonClick = (personId: string) => {
    setSelectedPersonId(personId)
    setIsPersonModalOpen(true)
  }

  const handleAddPerson = async (personData: CreatePersonData) => {
    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personData),
      })

      const created = await res.json()
      if (!res.ok || !created.success) {
        throw new Error(created.error || 'Failed to create person')
      }

      const createdPersonId: string | undefined = created.data?.id
      const relationshipType = personData.relationshipType
      const relationshipTargetId = personData.relationshipTo
      const supportedRelationshipTypes = new Set(['PARENT', 'CHILD', 'SPOUSE'])

      if (
        createdPersonId
        && relationshipTargetId
        && relationshipType
        && supportedRelationshipTypes.has(relationshipType)
      ) {
        await fetch(`/api/people/${createdPersonId}/relationships`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetPersonId: relationshipTargetId,
            relationshipType,
          }),
        })
      }

      // Refresh the tree
      fetchPeople()
    } catch {
      // Handle error
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <>
      <Head>
        <title>Family Tree | Heard Again</title>
        <meta name="description" content="Chart your family legacy across generations." />
      </Head>
      <FamilyTreePage 
        people={treeData} 
        onPersonClick={handlePersonClick}
        onAddPerson={() => setIsAddPersonModalOpen(true)}
      />
      
      <PersonModal
        open={isPersonModalOpen}
        personId={selectedPersonId}
        onClose={() => {
          setIsPersonModalOpen(false)
          setSelectedPersonId(null)
          fetchPeople()
        }}
        onSave={() => fetchPeople()}
        onDelete={() => fetchPeople()}
      />
      
      <AddPersonModal
        open={isAddPersonModalOpen}
        onClose={() => setIsAddPersonModalOpen(false)}
        onSave={handleAddPerson}
        existingPeople={people.map(p => ({ id: p.id, firstName: p.firstName, lastName: p.lastName }))}
      />
    </>
  )
}
