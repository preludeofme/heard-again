import Head from 'next/head'
import { FamilyTreePage } from '@/components/pages/FamilyTreePage'
import { PersonModal } from '@/components/modals/PersonModal'
import { AddPersonModal, CreatePersonData } from '@/components/modals/AddPersonModal'
import { useEffect, useState, useCallback } from 'react'
import { Box, CircularProgress } from '@mui/material'

interface ApiPerson {
  id: string
  firstName: string
  lastName?: string
  displayName?: string
  avatarUrl?: string
  personType: string
  counts?: {
    stories?: number
    voiceProfiles?: number
    relationships?: number
  }
}

interface RelationshipEdge {
  id: string
  type: 'SPOUSE' | 'PARENT' | 'CHILD'
  direction: 'outgoing' | 'incoming'
}

interface ApiPersonWithEdges extends ApiPerson {
  relationshipEdges: RelationshipEdge[]
}

interface FamilyTreePerson {
  id: string
  name: string
  role: string
  avatar: string
  memories?: number
  selected?: boolean
}

interface FamilyTreeData {
  grandparents: FamilyTreePerson[]
  parents: FamilyTreePerson[]
  children: FamilyTreePerson[]
}

function mapPeopleToTree(people: ApiPersonWithEdges[]): FamilyTreeData {
  const grandparents: FamilyTreePerson[] = []
  const parents: FamilyTreePerson[] = []
  const children: FamilyTreePerson[] = []

  for (const p of people) {
    const hasIncomingParent = p.relationshipEdges.some((r) => r.type === 'PARENT' && r.direction === 'incoming')
    const hasOutgoingChild = p.relationshipEdges.some((r) => r.type === 'CHILD' && r.direction === 'outgoing')
    const hasSpouse = p.relationshipEdges.some((r) => r.type === 'SPOUSE')

    const entry = {
      id: p.id,
      name: p.displayName || `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`,
      role: p.personType === 'SUBJECT' ? 'Subject' : 'Family Member',
      avatar: p.avatarUrl || '',
      memories: p.counts?.stories || 0,
    }

    if (hasOutgoingChild && !hasIncomingParent) {
      grandparents.push(entry)
      continue
    }

    if (hasOutgoingChild || hasSpouse || p.personType === 'SUBJECT') {
      parents.push({ ...entry, memories: 0, selected: true })
      continue
    }

    if (hasIncomingParent) {
      children.push(entry)
      continue
    }

    parents.push(entry)
  }

  if (parents.length === 0 && grandparents.length > 0) {
    parents.push(grandparents.shift()!)
  }

  if (parents.length === 0 && children.length > 0) {
    parents.push(children.shift()!)
  }

  return { grandparents, parents, children }
}

export default function FamilyTree() {
  const [treeData, setTreeData] = useState<FamilyTreeData | null>(null)
  const [people, setPeople] = useState<ApiPerson[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Modal states
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false)
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false)
  const [personModalInitialTab, setPersonModalInitialTab] = useState<'overview' | 'relationships'>('overview')

  const fetchPeople = useCallback(async () => {
    try {
      const res = await fetch('/api/people')
      const data = await res.json()
      if (data.success && data.data) {
        const basePeople = data.data as ApiPerson[]
        const peopleWithEdges = await Promise.all(basePeople.map(async (person): Promise<ApiPersonWithEdges> => {
          try {
            const relationshipsRes = await fetch(`/api/people/${person.id}/relationships`)
            const relationshipsData = await relationshipsRes.json()
            return {
              ...person,
              relationshipEdges: relationshipsRes.ok && relationshipsData.success
                ? (relationshipsData.data as RelationshipEdge[])
                : [],
            }
          } catch {
            return { ...person, relationshipEdges: [] }
          }
        }))

        setPeople(basePeople)
        setTreeData(mapPeopleToTree(peopleWithEdges))
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
    setPersonModalInitialTab('overview')
    setSelectedPersonId(personId)
    setIsPersonModalOpen(true)
  }

  const handleEditRelationships = (personId: string) => {
    setPersonModalInitialTab('relationships')
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
        people={treeData ?? undefined} 
        onPersonClick={handlePersonClick}
        onAddPerson={() => setIsAddPersonModalOpen(true)}
        onEditRelationships={handleEditRelationships}
      />
      
      <PersonModal
        open={isPersonModalOpen}
        personId={selectedPersonId}
        initialTab={personModalInitialTab}
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
