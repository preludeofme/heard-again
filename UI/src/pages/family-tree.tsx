import Head from 'next/head'
import { FamilyTreePage } from '@/components/pages/FamilyTreePage'
import { PersonModal } from '@/components/modals/PersonModal'
import { AddEditPersonModal, PersonFormData } from '@/components/modals/AddEditPersonModal'
import { SuccessModal } from '@/components/modals/SuccessModal'
import { Layout } from '@/components/layout/Layout'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Box, CircularProgress } from '@mui/material'
import { useRouter } from 'next/router'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'

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
  isBiological: boolean
  notes: string | null
  relatedPerson: {
    id: string
    firstName: string
    lastName: string | null
    nickname: string | null
    avatarAssetId: string | null
  }
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
  spouseWithNext?: boolean
  upperGenerationLinkType?: 'biological' | 'nonBiological' | 'none'
}

interface FamilyTreeRelationshipEdge {
  id: string
  sourceId: string
  targetId: string
  type: 'SPOUSE' | 'PARENT_CHILD'
  relationshipKind: 'biological' | 'nonBiological'
}

interface FamilyTreeData {
  grandparents: FamilyTreePerson[]
  parents: FamilyTreePerson[]
  children: FamilyTreePerson[]
  childrenConnectorParentId?: string
  relationshipEdges: FamilyTreeRelationshipEdge[]
}

function mapPeopleToTree(people: ApiPersonWithEdges[], activePersonId?: string): FamilyTreeData {
  const grandparents: FamilyTreePerson[] = []
  const parents: FamilyTreePerson[] = []
  const children: FamilyTreePerson[] = []

  if (people.length === 0) {
    return { grandparents, parents, children, relationshipEdges: [] }
  }

  const spouseIdsByPerson = new Map<string, Set<string>>()
  for (const person of people) {
    for (const edge of person.relationshipEdges) {
      if (edge.type !== 'SPOUSE') continue
      if (!spouseIdsByPerson.has(person.id)) {
        spouseIdsByPerson.set(person.id, new Set())
      }
      spouseIdsByPerson.get(person.id)!.add(edge.relatedPerson.id)
    }
  }

  const areSpouses = (leftId: string, rightId: string) => {
    return spouseIdsByPerson.get(leftId)?.has(rightId) ?? false
  }

  const sortByName = (ids: string[]) => {
    return [...ids].sort((leftId, rightId) => {
      const leftPerson = peopleById.get(leftId)
      const rightPerson = peopleById.get(rightId)
      const leftName = leftPerson?.displayName || `${leftPerson?.firstName || ''} ${leftPerson?.lastName || ''}`.trim()
      const rightName = rightPerson?.displayName || `${rightPerson?.firstName || ''} ${rightPerson?.lastName || ''}`.trim()
      return leftName.localeCompare(rightName)
    })
  }

  const orderGenerationIds = (ids: string[], anchorId?: string): string[] => {
    const orderedByName = sortByName(ids)
    const remaining = new Set(orderedByName)
    const ordered: string[] = []

    while (remaining.size > 0) {
      const anchorSeed = orderedByName.find((id) => remaining.has(id) && id === anchorId)
      const pairedSeed = orderedByName.find((id) => {
        if (!remaining.has(id)) return false
        const spouseSet = spouseIdsByPerson.get(id)
        return !!spouseSet && Array.from(remaining).some((candidateId) => candidateId !== id && spouseSet.has(candidateId))
      })
      const seed = anchorSeed || pairedSeed || orderedByName.find((id) => remaining.has(id))

      if (!seed) break

      remaining.delete(seed)
      ordered.push(seed)

      const partner = orderedByName.find((candidateId) => remaining.has(candidateId) && areSpouses(seed, candidateId))
      if (partner) {
        remaining.delete(partner)
        ordered.push(partner)
      }
    }

    if (!anchorId) {
      return ordered
    }

    const currentAnchorIndex = ordered.indexOf(anchorId)
    if (currentAnchorIndex === -1 || ordered.length <= 2) {
      return ordered
    }

    const centered = [...ordered]
    const centerIndex = Math.floor((centered.length - 1) / 2)
    const [anchorPersonId] = centered.splice(currentAnchorIndex, 1)
    centered.splice(centerIndex, 0, anchorPersonId)

    const spouseId = centered.find((personId) => personId !== anchorId && areSpouses(anchorId, personId))
    if (!spouseId) {
      return centered
    }

    const spouseIndex = centered.indexOf(spouseId)
    const anchorIndex = centered.indexOf(anchorId)
    if (Math.abs(spouseIndex - anchorIndex) <= 1) {
      return centered
    }

    const [movedSpouseId] = centered.splice(spouseIndex, 1)
    const preferredSpouseIndex = Math.min(anchorIndex + 1, centered.length)
    centered.splice(preferredSpouseIndex, 0, movedSpouseId)
    return centered
  }

  const selectedPerson = activePersonId
    ? people.find((person) => person.id === activePersonId)
    : undefined

  // Find the subject (explicit selected person first, otherwise person with most relationships)
  const subject = selectedPerson || people.reduce((prev, current) =>
    (prev.relationshipEdges.length > current.relationshipEdges.length) ? prev : current
  )

  const peopleById = new Map(people.map((person) => [person.id, person]))
  const generationByPersonId = new Map<string, number>([[subject.id, 0]])
  const queue: string[] = [subject.id]

  const getGenerationDelta = (edge: RelationshipEdge): number | null => {
    if (edge.type === 'SPOUSE') {
      return 0
    }

    if (edge.type === 'PARENT') {
      return edge.direction === 'incoming' ? 1 : -1
    }

    if (edge.type === 'CHILD') {
      return edge.direction === 'outgoing' ? -1 : 1
    }

    return null
  }

  while (queue.length > 0) {
    const currentPersonId = queue.shift()
    if (!currentPersonId) continue

    const currentPerson = peopleById.get(currentPersonId)
    const currentGeneration = generationByPersonId.get(currentPersonId)

    if (!currentPerson || currentGeneration === undefined) {
      continue
    }

    for (const edge of currentPerson.relationshipEdges) {
      const relatedPersonId = edge.relatedPerson.id
      if (!peopleById.has(relatedPersonId)) {
        continue
      }

      const delta = getGenerationDelta(edge)
      if (delta === null) {
        continue
      }

      const candidateGeneration = currentGeneration + delta
      const existingGeneration = generationByPersonId.get(relatedPersonId)

      if (
        existingGeneration === undefined
        || Math.abs(candidateGeneration) < Math.abs(existingGeneration)
      ) {
        generationByPersonId.set(relatedPersonId, candidateGeneration)
        queue.push(relatedPersonId)
      }
    }
  }

  const parentGenerationIds = people
    .filter((person) => (generationByPersonId.get(person.id) ?? (person.id === subject.id ? 0 : 0)) === 0)
    .map((person) => person.id)
  const parentGenerationIdSet = new Set(parentGenerationIds)
  const grandparentGenerationIdSet = new Set(
    people
      .filter((person) => (generationByPersonId.get(person.id) ?? 0) > 0)
      .map((person) => person.id)
  )

  const upperGenerationLinkTypeByParentId = new Map<string, 'biological' | 'nonBiological' | 'none'>()
  for (const parentId of parentGenerationIds) {
    const parent = peopleById.get(parentId)
    if (!parent) {
      upperGenerationLinkTypeByParentId.set(parentId, 'none')
      continue
    }

    let hasBiologicalUpperLink = false
    let hasNonBiologicalUpperLink = false

    for (const edge of parent.relationshipEdges) {
      if (edge.type !== 'PARENT' || edge.direction !== 'incoming') {
        continue
      }

      if (!grandparentGenerationIdSet.has(edge.relatedPerson.id)) {
        continue
      }

      if (edge.isBiological) {
        hasBiologicalUpperLink = true
      } else {
        hasNonBiologicalUpperLink = true
      }
    }

    if (hasBiologicalUpperLink) {
      upperGenerationLinkTypeByParentId.set(parentId, 'biological')
      continue
    }

    if (hasNonBiologicalUpperLink) {
      upperGenerationLinkTypeByParentId.set(parentId, 'nonBiological')
      continue
    }

    upperGenerationLinkTypeByParentId.set(parentId, 'none')
  }

  const parentScoreById = new Map<string, number>()
  for (const person of people) {
    const generation = generationByPersonId.get(person.id)
    if (generation === undefined || generation >= 0) {
      continue
    }

    for (const edge of person.relationshipEdges) {
      if (edge.type !== 'PARENT' || edge.direction !== 'incoming') {
        continue
      }
      if (!parentGenerationIdSet.has(edge.relatedPerson.id)) {
        continue
      }

      const currentScore = parentScoreById.get(edge.relatedPerson.id) || 0
      parentScoreById.set(edge.relatedPerson.id, currentScore + (edge.isBiological ? 2 : 1))
    }
  }

  let childrenConnectorParentId: string | undefined
  const scoredParents = Array.from(parentScoreById.entries())
  if (scoredParents.length > 0) {
    childrenConnectorParentId = scoredParents
      .sort((left, right) => right[1] - left[1])[0]?.[0]
  }

  const orderedParentIds = orderGenerationIds(parentGenerationIds, childrenConnectorParentId)
  const orderedParentIdSet = new Set(orderedParentIds)
  const grandparentIds = people
    .filter((person) => (generationByPersonId.get(person.id) ?? 0) > 0)
    .map((person) => person.id)
  const orderedGrandparentIds = orderGenerationIds(grandparentIds)
  const childrenIds = people
    .filter((person) => (generationByPersonId.get(person.id) ?? 0) < 0)
    .map((person) => person.id)
  const orderedChildrenIds = orderGenerationIds(childrenIds)

  const orderedIds = [
    ...orderedGrandparentIds,
    ...orderedParentIds,
    ...orderedChildrenIds,
    ...people
      .map((person) => person.id)
      .filter((personId) => !orderedParentIdSet.has(personId) && !orderedGrandparentIds.includes(personId) && !orderedChildrenIds.includes(personId)),
  ]

  const entryById = new Map<string, FamilyTreePerson>()
  
  for (const p of people) {
    const entry = {
      id: p.id,
      name: p.displayName || `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`,
      role: p.id === subject?.id ? 'Self' : 'Family Member',
      avatar: p.avatarUrl || '',
      memories: p.counts?.stories || 0,
    }
    entryById.set(p.id, entry)

  }

  for (let index = 0; index < orderedIds.length; index += 1) {
    const personId = orderedIds[index]
    const p = peopleById.get(personId)
    const entryBase = entryById.get(personId)
    if (!p || !entryBase) {
      continue
    }

    const nextPersonId = orderedIds[index + 1]
    const spouseWithNext = !!nextPersonId && areSpouses(personId, nextPersonId)
    const generation = generationByPersonId.get(p.id)
    const isSelected = p.id === subject.id
    const entry: FamilyTreePerson = {
      ...entryBase,
      selected: isSelected,
      spouseWithNext,
      upperGenerationLinkType: generation === 0
        ? (upperGenerationLinkTypeByParentId.get(personId) || 'none')
        : undefined,
    }

    // SUBJECT always goes in parents generation (center level)
    if (p.id === subject?.id) {
      parents.push(entry)
      continue
    }

    if (generation !== undefined) {
      if (generation > 0) {
        grandparents.push(entry)
        continue
      }

      if (generation < 0) {
        children.push(entry)
        continue
      }

      parents.push(entry)
      continue
    }

    // Default fallback - put in parents generation
    parents.push(entry)
  }

  if (parents.length === 0 && grandparents.length > 0) {
    parents.push(grandparents.shift()!)
  }

  if (parents.length === 0 && children.length > 0) {
    parents.push(children.shift()!)
  }

  const displayedPersonIdSet = new Set([...grandparents, ...parents, ...children].map((person) => person.id))
  const relationshipEdges: FamilyTreeRelationshipEdge[] = []
  const seenRelationshipEdgeKeys = new Set<string>()

  for (const person of people) {
    for (const edge of person.relationshipEdges) {
      const sourceCandidateId = person.id
      const relatedPersonId = edge.relatedPerson.id

      if (!displayedPersonIdSet.has(sourceCandidateId) || !displayedPersonIdSet.has(relatedPersonId)) {
        continue
      }

      if (edge.type === 'SPOUSE') {
        const [leftId, rightId] = [sourceCandidateId, relatedPersonId].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        const edgeKey = `SPOUSE:${leftId}:${rightId}`
        if (seenRelationshipEdgeKeys.has(edgeKey)) {
          continue
        }

        seenRelationshipEdgeKeys.add(edgeKey)
        relationshipEdges.push({
          id: edgeKey,
          sourceId: leftId,
          targetId: rightId,
          type: 'SPOUSE',
          relationshipKind: edge.isBiological ? 'biological' : 'nonBiological',
        })
        continue
      }

      let parentId: string | undefined
      let childId: string | undefined

      if (edge.type === 'PARENT' && edge.direction === 'incoming') {
        parentId = relatedPersonId
        childId = sourceCandidateId
      }

      if (edge.type === 'CHILD' && edge.direction === 'outgoing') {
        parentId = sourceCandidateId
        childId = relatedPersonId
      }

      if (!parentId || !childId) {
        continue
      }

      const edgeKey = `PARENT_CHILD:${parentId}:${childId}`
      if (seenRelationshipEdgeKeys.has(edgeKey)) {
        continue
      }

      seenRelationshipEdgeKeys.add(edgeKey)
      relationshipEdges.push({
        id: edgeKey,
        sourceId: parentId,
        targetId: childId,
        type: 'PARENT_CHILD',
        relationshipKind: edge.isBiological ? 'biological' : 'nonBiological',
      })
    }
  }

  return {
    grandparents,
    parents,
    children,
    childrenConnectorParentId,
    relationshipEdges,
  }
}

export default function FamilyTree() {
  const router = useRouter()
  const { setSelectedFamilyMember } = useSelectedFamilyMember()
  const selectedPersonIdFromQuery = typeof router.query.personId === 'string' ? router.query.personId : undefined
  const initialSearchExpanded =
    router.query.expandSearch === '1'
    || router.query.expandSearch === 'true'
  const initialSearchQuery = typeof router.query.search === 'string' ? router.query.search : ''
  const [treeData, setTreeData] = useState<FamilyTreeData | null>(null)
  const [people, setPeople] = useState<ApiPerson[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Modal states
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false)
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false)
  const [personModalInitialTab, setPersonModalInitialTab] = useState<'overview' | 'relationships'>('overview')
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)

  const fetchPeople = useCallback(async () => {
    try {
      // Use the optimized endpoint that returns all people with relationships in one call
      const res = await fetch('/api/people/family-tree', { credentials: 'include' })
      const data = await res.json()
      
      if (data.success && data.data) {
        const peopleWithEdges = data.data as ApiPersonWithEdges[]
        
        // Extract base people without relationships for other uses
        const basePeople = peopleWithEdges.map(({ relationshipEdges, ...person }) => person)
        
        setPeople(basePeople)
        setTreeData(mapPeopleToTree(peopleWithEdges, selectedPersonIdFromQuery))
      }
    } catch {
      // Fall through to render with empty data
    } finally {
      setIsLoading(false)
    }
  }, [selectedPersonIdFromQuery])

  useEffect(() => {
    fetchPeople()
  }, [fetchPeople])

  const handlePersonClick = (person: { id: string | number; name: string; avatar: string }) => {
    // Parse name into first and last name
    const nameParts = person.name.split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || undefined
    
    // Set the selected family member in context for app-wide filtering
    setSelectedFamilyMember({
      id: String(person.id),
      firstName,
      lastName,
      displayName: person.name,
      avatarUrl: person.avatar || undefined,
    })
    router.push(`/profile/${person.id}`)
  }

  const handleEditRelationships = (personId: string) => {
    setPersonModalInitialTab('relationships')
    setSelectedPersonId(personId)
    setIsPersonModalOpen(true)
  }

  const handleAddPerson = async (personData: PersonFormData) => {
    try {
      // Filter out relationship fields for person creation
      const {
        relationshipTo: relationshipTargetId,
        relationshipType: relationshipTypeValue,
        relationshipKind: relationshipKindValue,
        marriageDate,
        marriagePlace,
        ...personCreateData
      } = personData
      
      // Clean up empty strings for optional fields
      const cleanedData = {
        ...personCreateData,
        displayName: personCreateData.displayName || undefined,
        nickname: personCreateData.nickname || undefined,
        maidenName: personCreateData.maidenName || undefined,
        suffix: personCreateData.suffix || undefined,
        middleName: personCreateData.middleName || undefined,
        birthDate: personCreateData.birthDate || undefined,
        deathDate: personCreateData.deathDate || undefined,
        bio: personCreateData.bio || undefined,
        tags: personCreateData.tags || undefined,
      }
      
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(cleanedData),
      })

      const created = await res.json()
      if (!res.ok || !created.success) {
        throw new Error(created.error || 'Failed to create person')
      }

      const createdPersonId: string | undefined = created.data?.id
      const supportedRelationshipTypes = new Set(['PARENT', 'CHILD', 'SPOUSE'])

      if (
        createdPersonId
        && relationshipTargetId
        && relationshipTypeValue
        && supportedRelationshipTypes.has(relationshipTypeValue)
      ) {
        const relationshipPayload: any = {
          targetPersonId: relationshipTargetId,
          relationshipType: relationshipTypeValue,
          relationshipKind: relationshipKindValue || 'BIOLOGICAL',
          isBiological: relationshipKindValue ? relationshipKindValue === 'BIOLOGICAL' : true,
        }
        
        // Add marriage date/place for spouse relationships
        if (relationshipTypeValue === 'SPOUSE') {
          if (marriageDate) relationshipPayload.marriageDate = marriageDate
          if (marriagePlace) relationshipPayload.marriagePlace = marriagePlace
        }
        
        const relationshipRes = await fetch(`/api/people/${createdPersonId}/relationships`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(relationshipPayload),
        })
        
        if (!relationshipRes.ok) {
          const relationshipError = await relationshipRes.json()
          console.error('Failed to create relationship:', relationshipError)
          // Don't throw error - person was created successfully, just log relationship issue
        }
      }

      // Close modal on success
      setIsAddPersonModalOpen(false)
      
      // Show success modal
      setIsSuccessModalOpen(true)
      
      // Refresh the tree
      fetchPeople()
    } catch (error) {
      console.error('Failed to create person:', error)
      // Show error to user but don't re-throw to allow modal to handle properly
      throw error
    }
  }

  const [isFullscreen, setIsFullscreen] = useState(false)

  if (isLoading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  const treeContent = (
    <FamilyTreePage 
      people={treeData ?? undefined} 
      onPersonClick={handlePersonClick}
      onAddPerson={() => setIsAddPersonModalOpen(true)}
      onEditRelationships={handleEditRelationships}
      isFullscreen={isFullscreen}
      onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
      initialSearchExpanded={initialSearchExpanded}
      initialSearchQuery={initialSearchQuery}
    />
  )

  return (
    <>
      <Head>
        <title>Family Tree | Heard Again</title>
        <meta name="description" content="Chart your family legacy across generations." />
      </Head>
      {isFullscreen ? treeContent : <Layout>{treeContent}</Layout>}
      
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
      
      <AddEditPersonModal
        open={isAddPersonModalOpen}
        onClose={() => setIsAddPersonModalOpen(false)}
        mode="create"
        onSubmit={handleAddPerson}
        existingPeople={people.map(p => ({ id: p.id, firstName: p.firstName, lastName: p.lastName }))}
      />
      
      <SuccessModal
        open={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        title="Person Created Successfully!"
        message="The new family member has been added to your family tree."
      />
    </>
  )
}
