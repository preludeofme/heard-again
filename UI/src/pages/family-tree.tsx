import Head from 'next/head'
import { FamilyTreePage } from '@/components/pages/FamilyTreePage'
import { PersonModal } from '@/components/modals/PersonModal'
import { AddEditPersonModal, PersonFormData } from '@/components/modals/AddEditPersonModal'
import { SuccessModal } from '@/components/modals/SuccessModal'
import { Layout } from '@/components/layout/Layout'
import { GedcomImportModal } from '@/components/modals/GedcomImportModal'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Box, CircularProgress } from '@mui/material'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'
import { fetchWithCSRF, fetchWithCSRFAndJSON } from '@/lib/api-client'

interface ApiPerson {
  id: string
  firstName: string
  lastName?: string
  displayName?: string
  avatarUrl?: string
  personType: string
  sex?: 'M' | 'F' | 'U' | 'X'
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
    sex?: 'M' | 'F' | 'U' | 'X'
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
  sex?: 'M' | 'F' | 'U' | 'X'
  generation?: number
}

interface FamilyTreeRelationshipEdge {
  id: string
  sourceId: string
  targetId: string
  type: 'SPOUSE' | 'PARENT_CHILD'
  relationshipKind: 'biological' | 'nonBiological'
}

interface FamilyTreeData {
  generations: Record<number, FamilyTreePerson[]>
  relationshipEdges: FamilyTreeRelationshipEdge[]
  rootPersonId?: string
}

function sortBySpouseAdjacency(
  people: FamilyTreePerson[],
  spouseIdsByPerson: Map<string, Set<string>>
): FamilyTreePerson[] {
  const result: FamilyTreePerson[] = []
  const placed = new Set<string>()

  for (const person of people) {
    const personId = String(person.id)
    if (placed.has(personId)) continue
    placed.add(personId)
    result.push(person)

    const spouseIds = spouseIdsByPerson.get(personId) ?? new Set<string>()
    for (const spouseId of spouseIds) {
      if (!placed.has(spouseId)) {
        const spouse = people.find((p) => String(p.id) === spouseId)
        if (spouse) {
          placed.add(spouseId)
          result.push(spouse)
        }
      }
    }
  }

  return result
}

function mapPeopleToTree(people: ApiPersonWithEdges[], activePersonId?: string): FamilyTreeData {
  const generations: Record<number, FamilyTreePerson[]> = {}

  if (people.length === 0) {
    return { generations: {}, relationshipEdges: [] }
  }

  const peopleById = new Map(people.map((person) => [person.id, person]))

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

  // Find the subject: use activePersonId if provided, otherwise find the most connected person
  const subject = (activePersonId && peopleById.get(activePersonId)) || people.reduce((prev, current) => {
    const prevScore = prev.relationshipEdges.length + 
      (prev.relationshipEdges.some(e => e.type === 'PARENT') ? 10 : 0) +
      (prev.relationshipEdges.some(e => e.type === 'CHILD') ? 10 : 0)
    const currentScore = current.relationshipEdges.length + 
      (current.relationshipEdges.some(e => e.type === 'PARENT') ? 10 : 0) +
      (current.relationshipEdges.some(e => e.type === 'CHILD') ? 10 : 0)
    return currentScore > prevScore ? current : prev
  })

  const generationByPersonId = new Map<string, number>([[subject.id, 0]])
  const queue: string[] = [subject.id]

  const getGenerationDelta = (edge: RelationshipEdge): number | null => {
    if (edge.type === 'SPOUSE') return 0
    if (edge.type === 'PARENT') return 1 // API says this is my parent
    if (edge.type === 'CHILD') return -1  // API says this is my child
    return null
  }

  while (queue.length > 0) {
    const currentPersonId = queue.shift()!
    const currentPerson = peopleById.get(currentPersonId)!
    const currentGeneration = generationByPersonId.get(currentPersonId)!

    for (const edge of currentPerson.relationshipEdges) {
      const relatedPersonId = edge.relatedPerson.id
      if (!peopleById.has(relatedPersonId)) continue

      const delta = getGenerationDelta(edge)
      if (delta === null) continue

      if (!generationByPersonId.has(relatedPersonId)) {
        generationByPersonId.set(relatedPersonId, currentGeneration + delta)
        queue.push(relatedPersonId)
      }
    }
  }

  const getRoleLabel = (personId: string, sex?: string): string => {
    if (personId === subject.id) return 'Self'
    if (areSpouses(personId, subject.id)) return sex === 'M' ? 'Husband' : (sex === 'F' ? 'Wife' : 'Spouse')

    const generation = generationByPersonId.get(personId)
    if (generation === undefined) return 'Family Member'

    if (generation === 0) return 'Family Member' // Likely a sibling or cousin
    if (generation === 1) return sex === 'M' ? 'Father' : (sex === 'F' ? 'Mother' : 'Parent')
    if (generation === 2) return sex === 'M' ? 'Grandfather' : (sex === 'F' ? 'Grandmother' : 'Grandparent')
    if (generation === -1) return sex === 'M' ? 'Son' : (sex === 'F' ? 'Daughter' : 'Child')
    if (generation === -2) return sex === 'M' ? 'Grandson' : (sex === 'F' ? 'Granddaughter' : 'Grandchild')

    return generation > 0 ? 'Ancestor' : 'Descendant'
  }

  const entryById = new Map<string, FamilyTreePerson>()
  
  for (const p of people) {
    const gen = generationByPersonId.get(p.id) ?? 0
    const entry: FamilyTreePerson = {
      id: p.id,
      name: p.displayName || `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`,
      role: getRoleLabel(p.id, p.sex),
      avatar: p.avatarUrl || '',
      memories: p.counts?.stories || 0,
      sex: p.sex,
      generation: gen,
      selected: p.id === subject.id
    }
    entryById.set(p.id, entry)

    if (!generations[gen]) generations[gen] = []
    generations[gen].push(entry)
  }

  // Sort each generation row so spouses are adjacent; spouse connectors are drawn
  // as horizontal lines between card positions and will cross other cards if spouses
  // are not next to each other in the row.
  for (const gen of Object.keys(generations)) {
    const genNum = Number(gen)
    if (generations[genNum].length > 1) {
      generations[genNum] = sortBySpouseAdjacency(generations[genNum], spouseIdsByPerson)
    }
  }

  const relationshipEdges: FamilyTreeRelationshipEdge[] = []
  const seenRelationshipEdgeKeys = new Set<string>()

  for (const person of people) {
    for (const edge of person.relationshipEdges) {
      const sourceId = person.id
      const targetId = edge.relatedPerson.id

      if (edge.type === 'SPOUSE') {
        const [leftId, rightId] = [sourceId, targetId].sort()
        const key = `SPOUSE:${leftId}:${rightId}`
        if (seenRelationshipEdgeKeys.has(key)) continue
        seenRelationshipEdgeKeys.add(key)
        relationshipEdges.push({
          id: key, sourceId: leftId, targetId: rightId, type: 'SPOUSE', relationshipKind: 'biological'
        })
      } else if (edge.type === 'CHILD') {
        // Person is parent, related is child
        const key = `PARENT_CHILD:${sourceId}:${targetId}`
        if (seenRelationshipEdgeKeys.has(key)) continue
        seenRelationshipEdgeKeys.add(key)
        relationshipEdges.push({
          id: key, sourceId, targetId, type: 'PARENT_CHILD', relationshipKind: edge.isBiological ? 'biological' : 'nonBiological'
        })
      } else if (edge.type === 'PARENT') {
        // Person is child, related is parent
        const key = `PARENT_CHILD:${targetId}:${sourceId}`
        if (seenRelationshipEdgeKeys.has(key)) continue
        seenRelationshipEdgeKeys.add(key)
        relationshipEdges.push({
          id: key, sourceId: targetId, targetId: sourceId, type: 'PARENT_CHILD', relationshipKind: edge.isBiological ? 'biological' : 'nonBiological'
        })
      }
    }
  }

  return { generations, relationshipEdges, rootPersonId: subject.id }
}

export default function FamilyTree() {
  const router = useRouter()
  const { data: session } = useSession()
  const familyspaceId = session?.user?.defaultFamilyspaceId

  const { setSelectedFamilyMember } = useSelectedFamilyMember()
  const selectedPersonIdFromQuery = typeof router.query.personId === 'string' ? router.query.personId : undefined
  const initialSearchExpanded =
    router.query.expandSearch === '1'
    || router.query.expandSearch === 'true'
  const initialSearchQuery = typeof router.query.search === 'string' ? router.query.search : ''
  const [treeData, setTreeData] = useState<FamilyTreeData | null>(null)
  const [people, setPeople] = useState<ApiPerson[]>([])
  const [rawPeople, setRawPeople] = useState<ApiPersonWithEdges[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [allSearchablePeople, setAllSearchablePeople] = useState<any[]>([])
  
  // Family Bio state
  const [familyBio, setFamilyBio] = useState<string | null>(null)
  const [isGeneratingBio, setIsGeneratingBio] = useState(false)

  // Modal states
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false)
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false)
  const [isGedcomImportModalOpen, setIsGedcomImportModalOpen] = useState(false)
  const [personModalInitialTab, setPersonModalInitialTab] = useState<'overview' | 'relationships'>('overview')
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)

  const [fitViewTrigger, setFitViewTrigger] = useState(0)
  const [loadedDepths, setLoadedDepths] = useState({ up: 2, down: 2 })
  const [includeSiblings, setIncludeSiblings] = useState(false)
  const [isIncrementalLoading, setIsIncrementalLoading] = useState(false)
  const [expandedPersonIds, setExpandedPersonIds] = useState<{ up: Set<string>; down: Set<string>; siblings: Set<string> }>({ up: new Set(), down: new Set(), siblings: new Set() })

  const fetchFamilyBio = useCallback(async () => {
    if (!familyspaceId) return
    try {
      const res = await fetch(`/api/familyspaces/${familyspaceId}/generate-bio`)
      const data = await res.json()
      if (data.success) {
        setFamilyBio(data.data.bio)
      }
    } catch (err) {
      console.error('Failed to fetch family bio:', err)
    }
  }, [familyspaceId])

  const handleGenerateBio = useCallback(async () => {
    if (!familyspaceId) return
    setIsGeneratingBio(true)
    try {
      const response = await fetchWithCSRFAndJSON(`/api/familyspaces/${familyspaceId}/generate-bio`, {})
      const data = await response.json()
      if (data.success) {
        setFamilyBio(data.data.bio)
      } else {
        alert(data.error || 'Failed to generate biography.')
      }
    } catch (err) {
      console.error('Failed to generate family bio:', err)
    } finally {
      setIsGeneratingBio(false)
    }
  }, [familyspaceId])

  useEffect(() => {
    if (familyspaceId) {
      fetchFamilyBio()
    }
  }, [familyspaceId, fetchFamilyBio])

  const fetchSearchablePeople = useCallback(async () => {
    try {
      const res = await fetch('/api/people?limit=500', { credentials: 'include' })
      const data = await res.json()
      if (data.success && data.data?.people) {
        setAllSearchablePeople(data.data.people)
      }
    } catch (err) {
      console.error('Failed to fetch searchable people:', err)
    }
  }, [])

  const fetchPeople = useCallback(async (depths = { up: 2, down: 2 }, rootId?: string, siblings = true, expandIds?: { up: Set<string>; down: Set<string>; siblings: Set<string> }) => {
    try {
      const rootParam = rootId ? `&rootPersonId=${rootId}` : ''
      const expandUpParam = expandIds?.up.size ? `&expandUp=${Array.from(expandIds.up).join(',')}` : ''
      const expandDownParam = expandIds?.down.size ? `&expandDown=${Array.from(expandIds.down).join(',')}` : ''
      const expandSiblingsParam = expandIds?.siblings.size ? `&expandSiblings=${Array.from(expandIds.siblings).join(',')}` : ''
      const res = await fetch(`/api/people/family-tree?depthUp=${depths.up}&depthDown=${depths.down}&includeSiblings=${siblings}${rootParam}${expandUpParam}${expandDownParam}${expandSiblingsParam}`, { credentials: 'include' })
      const data = await res.json()
      
      if (data.success && data.data) {
        const peopleWithEdges = data.data as ApiPersonWithEdges[]
        const basePeople = peopleWithEdges.map(({ relationshipEdges, ...person }) => person)

        setPeople(basePeople)
        setRawPeople(peopleWithEdges)
        // Use the rootPersonId returned by API to ensure consistency
        const effectiveRootId = data.rootPersonId || rootId || selectedPersonIdFromQuery
        const mapped = mapPeopleToTree(peopleWithEdges, effectiveRootId)
        setTreeData(mapped)
        setLoadedDepths(depths)
        setIncludeSiblings(siblings)
      }
    } catch (err) {
      console.error('Fetch failed:', err)
    } finally {
      setIsLoading(false)
      setIsIncrementalLoading(false)
    }
  }, [selectedPersonIdFromQuery])

  useEffect(() => {
    fetchPeople({ up: 2, down: 2 }, undefined, false)
    fetchSearchablePeople()
  }, [fetchPeople, fetchSearchablePeople])

  // Logic to load more when needed — expands only the specific person's branch
  const handleLoadMore = useCallback(async (direction: 'up' | 'down' | 'left' | 'right', personId: string) => {
    if (isIncrementalLoading) return
    setIsIncrementalLoading(true)

    const newExpanded = {
      up: new Set(expandedPersonIds.up),
      down: new Set(expandedPersonIds.down),
      siblings: new Set(expandedPersonIds.siblings),
    }
    
    if (direction === 'up') newExpanded.up.add(personId)
    else if (direction === 'down') newExpanded.down.add(personId)
    else newExpanded.siblings.add(personId) // left or right

    setExpandedPersonIds(newExpanded)

    await fetchPeople(loadedDepths, treeData?.rootPersonId, includeSiblings, newExpanded)
  }, [expandedPersonIds, loadedDepths, isIncrementalLoading, fetchPeople, treeData?.rootPersonId, includeSiblings])

  const handleToggleSiblings = useCallback(() => {
    if (isIncrementalLoading) return
    setIsIncrementalLoading(true)
    fetchPeople(loadedDepths, treeData?.rootPersonId, !includeSiblings, expandedPersonIds)
  }, [loadedDepths, treeData?.rootPersonId, includeSiblings, fetchPeople, isIncrementalLoading, expandedPersonIds])

  const handleExpandDepth = useCallback(() => {
    if (isIncrementalLoading) return
    setIsIncrementalLoading(true)
    const newDepths = { up: loadedDepths.up + 1, down: loadedDepths.down + 1 }
    fetchPeople(newDepths, treeData?.rootPersonId, includeSiblings, expandedPersonIds)
  }, [loadedDepths, treeData?.rootPersonId, includeSiblings, fetchPeople, isIncrementalLoading, expandedPersonIds])

  const handleSetRoot = useCallback((id: string) => {
    if (isIncrementalLoading) return
    setIsIncrementalLoading(true)
    const cleared = { up: new Set<string>(), down: new Set<string>(), siblings: new Set<string>() }
    setExpandedPersonIds(cleared)
    fetchPeople({ up: 2, down: 2 }, id, false, cleared)
  }, [fetchPeople, isIncrementalLoading])

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
    // No longer navigating directly - the detail modal will open via useFamilyTree logic
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
        avatarFile,
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

      const res = await fetchWithCSRFAndJSON('/api/people', cleanedData)

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
        
        const relationshipRes = await fetchWithCSRFAndJSON(`/api/people/${createdPersonId}/relationships`, relationshipPayload)
        
        if (!relationshipRes.ok) {
          const relationshipError = await relationshipRes.json()
          console.error('Failed to create relationship:', relationshipError)
          // Don't throw error - person was created successfully, just log relationship issue
        }
      }

      if (avatarFile && createdPersonId) {
        const form = new FormData()
        form.append('file', avatarFile)
        const avatarRes = await fetchWithCSRF(`/api/people/${createdPersonId}/avatar`, {
          method: 'POST',
          body: form,
        })
        if (!avatarRes.ok) {
          console.warn('Avatar upload failed:', await avatarRes.text())
        }
      }

      // Close modal on success
      setIsAddPersonModalOpen(false)
      
      // Show success modal
      setIsSuccessModalOpen(true)
      
      // Refresh the tree, centering on the new person
      fetchPeople({ up: 2, down: 2 }, createdPersonId, false)
    } catch (error) {
      console.error('Failed to create person:', error)
      // Show error to user but don't re-throw to allow modal to handle properly
      throw error
    }
  }

  const [isFullscreen, setIsFullscreen] = useState(false)

  const handleExportGedcom = async () => {
    try {
      const response = await fetchWithCSRFAndJSON('/api/export/gedcom', {})
      if (!response.ok) throw new Error('Export failed')
      
      const data = await response.json()
      if (data.success && data.data.downloadUrl) {
        // Trigger download
        window.location.href = data.data.downloadUrl
      }
    } catch (error) {
      console.error('Failed to export GEDCOM:', error)
    }
  }

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
        rawPeople={rawPeople}
        searchablePeople={allSearchablePeople}
        rootPersonId={treeData?.rootPersonId}
        onPersonClick={handlePersonClick}
        onAddPerson={() => setIsAddPersonModalOpen(true)}
        onEditRelationships={handleEditRelationships}
        onPeopleChanged={fetchPeople}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
        onImportGedcom={() => setIsGedcomImportModalOpen(true)}
        onExportGedcom={handleExportGedcom}
        initialSearchExpanded={initialSearchExpanded}
        initialSearchQuery={initialSearchQuery}
        onLoadMore={handleLoadMore}
        onToggleSiblings={handleToggleSiblings}
        onExpandDepth={handleExpandDepth}
        onSetRoot={handleSetRoot}
        includeSiblings={includeSiblings}
        loadedDepths={loadedDepths}
        isLoadingMore={isIncrementalLoading}
        fitViewTrigger={fitViewTrigger}
        familyBio={familyBio}
        onGenerateBio={handleGenerateBio}
        isGeneratingBio={isGeneratingBio}
        userPersonId={session?.user?.linkedPersonId}
        onViewFullProfile={(id) => {
          router.push(`/profile/${id}`)
        }}
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
        onPersonClick={(id) => {
          setSelectedPersonId(id)
        }}
        onSave={() => fetchPeople()}
        onDelete={() => fetchPeople()}
        onViewFullProfile={(id) => {
          router.push(`/profile/${id}`)
        }}
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

      <GedcomImportModal
        open={isGedcomImportModalOpen}
        onClose={() => setIsGedcomImportModalOpen(false)}
        userPersonId={treeData?.rootPersonId}
        onSuccess={async () => {
          await fetchPeople()
          setFitViewTrigger(t => t + 1)
        }}
      />
    </>
  )
}


export async function getServerSideProps() { return { props: {} } }
