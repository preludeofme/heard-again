import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Card,
  Avatar,
  Divider,
  IconButton,
  useTheme,
} from '@mui/material'
import {
  ZoomIn,
  ZoomOut,
  RestartAlt,
  Add,
  AutoFixHigh,
  AutoStories,
  Edit,
  PersonAdd,
  PanTool,
  NearMe,
  ExpandMore,
  ExpandLess,
  Fullscreen,
  FullscreenExit,
  Search,
} from '@mui/icons-material'
import { PersonDetailModal } from '@/components/modals/PersonDetailModal'
import { AddEditPersonModal, PersonFormData } from '@/components/modals/AddEditPersonModal'

interface TreePerson {
  id: string | number
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
  grandparents: TreePerson[]
  parents: TreePerson[]
  children: TreePerson[]
  childrenConnectorParentId?: string
  relationshipEdges: FamilyTreeRelationshipEdge[]
}

interface SearchableFamilyMember {
  id: string
  name: string
  relationship: string
  avatar: string
}

interface FamilyTreePageProps {
  people?: FamilyTreeData
  onPersonClick?: (personId: string) => void
  onAddPerson?: () => void
  onEditRelationships?: (personId: string) => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  initialSearchExpanded?: boolean
  initialSearchQuery?: string
}

const defaultFamilyData: FamilyTreeData = {
  grandparents: [],
  parents: [],
  children: [],
  relationshipEdges: [],
}

const CONNECTOR_COLOR = 'rgba(22, 51, 74, 0.42)'
const CONNECTOR_SPOUSE_COLOR = 'rgba(22, 51, 74, 0.34)'
const CONNECTOR_BIOLOGICAL_COLOR = 'rgba(22, 51, 74, 0.52)'
const CONNECTOR_NON_BIO_COLOR = 'rgba(22, 51, 74, 0.35)'
const CONNECTOR_THICKNESS = 3
const GRANDPARENT_CARD_WIDTH = 256
const GRANDPARENT_GAP = 64
const PARENT_CARD_WIDTH = 288
const PARENT_GAP = 48
const CHILD_CARD_WIDTH = 240
const CHILD_GAP = 64

const getGenerationWidth = (count: number, cardWidth: number, gap: number) => {
  if (count <= 0) return 0
  return count * cardWidth + (count - 1) * gap
}

type TreeNodeLevel = 'grandparent' | 'parent' | 'child'

interface CardPosition {
  id: string
  person: TreePerson
  level: TreeNodeLevel
  x: number
  y: number
  width: number
  estimatedHeight: number
}

interface ConnectorPath {
  id: string
  d: string
  stroke: string
  strokeWidth: number
  strokeDasharray?: string
}

const GRANDPARENT_CARD_HEIGHT = 100
const PARENT_CARD_HEIGHT = 290
const CHILD_CARD_HEIGHT = 85
const SPOUSE_GAP = 24

function FamilyMemberCard({
  person,
  level,
  isSelf,
  onPersonClick,
  onAddPerson,
}: {
  person: TreePerson
  level: TreeNodeLevel
  isSelf?: boolean
  onPersonClick: (personId: string) => void
  onAddPerson: () => void
}) {
  const isParentLevel = level === 'parent'
  const cardWidth = level === 'grandparent' ? GRANDPARENT_CARD_WIDTH : level === 'parent' ? PARENT_CARD_WIDTH : CHILD_CARD_WIDTH

  const selfCardColor = '#1a6b5a'
  const selfCardOutline = 'rgba(26, 107, 90, 0.08)'

  return (
    <Card
      onClick={() => onPersonClick(String(person.id))}
      sx={
        isParentLevel
          ? {
            bgcolor: isSelf ? selfCardColor : 'primary.main',
            p: 4,
            borderRadius: 6,
            width: cardWidth,
            position: 'relative',
            boxShadow: isSelf
              ? '0 20px 25px -5px rgba(26, 107, 90, 0.18)'
              : '0 20px 25px -5px rgba(0,0,0,0.1)',
            outline: 8,
            outlineColor: isSelf ? selfCardOutline : 'rgba(22, 51, 74, 0.05)',
            cursor: 'pointer',
          }
          : {
            bgcolor: 'background.paper',
            p: 3,
            borderRadius: 4,
            width: cardWidth,
            boxShadow: '0 10px 40px rgba(28, 28, 25, 0.06)',
            border: '1px solid',
            borderColor: 'rgba(22, 51, 74, 0.05)',
            transition: 'transform 0.3s',
            cursor: 'pointer',
            '&:hover': { transform: 'translateY(-4px)' },
          }
      }
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: isParentLevel ? 3 : 0 }}>
        <Avatar
          src={person.avatar}
          sx={
            isParentLevel
              ? {
                width: 64,
                height: 64,
                border: 2,
                borderColor: 'rgba(205, 229, 255, 0.5)',
              }
              : { width: level === 'grandparent' ? 56 : 48, height: level === 'grandparent' ? 56 : 48 }
          }
        />
        <Box>
          <Typography
            variant={isParentLevel ? 'h5' : 'h6'}
            sx={{
              fontFamily: 'var(--font-newsreader), serif',
              color: isParentLevel ? 'white' : 'primary.main',
              fontSize: level === 'child' ? '1.125rem' : undefined,
            }}
          >
            {person.name}
          </Typography>
          <Typography variant={isParentLevel ? 'body2' : 'caption'} sx={{ color: isParentLevel ? 'rgba(255,255,255,0.7)' : 'secondary.main', fontWeight: 500 }}>
            {isParentLevel ? `${person.role} • ${person.memories || 0} Memories` : person.role}
          </Typography>
        </Box>
      </Box>

      {isParentLevel && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            fullWidth
            variant="text"
            startIcon={<AutoStories />}
            sx={{
              color: 'white',
              bgcolor: 'rgba(255,255,255,0.1)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              justifyContent: 'center',
              py: 1,
              borderRadius: 2,
            }}
          >
            View Archive
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="text"
              startIcon={<Edit />}
              onClick={(event) => {
                event.stopPropagation()
                onPersonClick(String(person.id))
              }}
              sx={{
                flex: 1,
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.1)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                justifyContent: 'center',
                py: 1,
                borderRadius: 2,
              }}
            >
              Edit
            </Button>
            <Button
              variant="text"
              startIcon={<PersonAdd />}
              onClick={(event) => {
                event.stopPropagation()
                onAddPerson()
              }}
              sx={{
                flex: 1,
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.1)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                justifyContent: 'center',
                py: 1,
                borderRadius: 2,
              }}
            >
              Add
            </Button>
            </Box>
          </Box>
      )}
    </Card>
  )
}

export function FamilyTreePage({
  people,
  onPersonClick,
  onAddPerson,
  onEditRelationships,
  isFullscreen = false,
  onToggleFullscreen,
  initialSearchExpanded = false,
  initialSearchQuery = '',
}: FamilyTreePageProps) {
  const theme = useTheme()
  const familyData = people && (people.grandparents.length > 0 || people.parents.length > 0 || people.children.length > 0)
    ? people
    : defaultFamilyData

  const parentRowWidth = getGenerationWidth(
    familyData.parents.length,
    PARENT_CARD_WIDTH,
    PARENT_GAP
  )

  const grandparentRowWidth = getGenerationWidth(
    familyData.grandparents.length,
    GRANDPARENT_CARD_WIDTH,
    GRANDPARENT_GAP
  )

  const childrenRowWidth = getGenerationWidth(
    familyData.children.length,
    CHILD_CARD_WIDTH,
    CHILD_GAP
  )

  const treeCanvasWidth = Math.max(
    grandparentRowWidth,
    parentRowWidth,
    childrenRowWidth,
    PARENT_CARD_WIDTH
  )

  const GRANDPARENT_ROW_Y = 20
  const PARENT_ROW_Y = 260
  const CHILD_ROW_Y = 630
  const TREE_FLOW_HEIGHT = familyData.children.length > 0 ? 900 : 520

  // Modal states
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [addEditModalOpen, setAddEditModalOpen] = useState(false)
  const [addEditMode, setAddEditMode] = useState<'create' | 'edit'>('create')
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [toolMode, setToolMode] = useState<'pointer' | 'hand'>('pointer')
  const [legendCollapsed, setLegendCollapsed] = useState(false)
  const [insightCollapsed, setInsightCollapsed] = useState(false)
  const [isSearchExpanded, setIsSearchExpanded] = useState(initialSearchExpanded)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(initialSearchQuery)
  const [selectedSearchMemberId, setSelectedSearchMemberId] = useState<string | null>(null)

  // Canvas drag state
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const panStart = useRef({ x: 0, y: 0 })

  // Data states
  const [personDetail, setPersonDetail] = useState<any>(null)
  const [personStories, setPersonStories] = useState<any[]>([])
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const searchableMembers = useMemo<SearchableFamilyMember[]>(() => {
    const normalize = (person: TreePerson): SearchableFamilyMember => ({
      id: String(person.id),
      name: person.name,
      relationship: person.role,
      avatar: person.avatar,
    })

    return [
      ...familyData.grandparents.map(normalize),
      ...familyData.parents.map(normalize),
      ...familyData.children.map(normalize),
    ]
  }, [familyData.grandparents, familyData.parents, familyData.children])

  const filteredSearchResults = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase()
    if (!query) return []

    return searchableMembers
      .filter((member) => {
        return member.name.toLowerCase().includes(query) || member.relationship.toLowerCase().includes(query)
      })
      .slice(0, 8)
  }, [debouncedSearchQuery, searchableMembers])

  const selectedSearchMember = useMemo(
    () => searchableMembers.find((member) => member.id === selectedSearchMemberId) || null,
    [searchableMembers, selectedSearchMemberId]
  )

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 250)

    return () => clearTimeout(timeout)
  }, [searchQuery])

  useEffect(() => {
    setIsSearchExpanded(initialSearchExpanded)
  }, [initialSearchExpanded])

  useEffect(() => {
    setSearchQuery(initialSearchQuery)
    setDebouncedSearchQuery(initialSearchQuery)
  }, [initialSearchQuery])

  // Handlers
  const handlePersonClick = async (personId: string) => {
    setSelectedPersonId(personId)
    setDetailModalOpen(true)
    onPersonClick?.(personId)
    
    // Fetch person details
    setIsLoadingDetail(true)
    setDetailError(null)
    try {
      const res = await fetch(`/api/people/${personId}`)
      const data = await res.json()
      if (data.success) {
        setPersonDetail(data.data)
        // Also fetch stories for this person
        const storiesRes = await fetch(`/api/stories?personId=${personId}&limit=20`)
        const storiesData = await storiesRes.json()
        setPersonStories(storiesData.data?.stories || [])
      } else {
        setDetailError(data.error || 'Failed to load person details')
      }
    } catch (err) {
      setDetailError('Failed to load person details')
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const handleAddPerson = () => {
    setSelectedPersonId(null)
    setAddEditMode('create')
    // Only call parent function - don't open duplicate modal
    onAddPerson?.()
  }

  const handleEditPerson = () => {
    setDetailModalOpen(false)
    setAddEditMode('edit')
    setAddEditModalOpen(true)
  }

  const handleSubmitPerson = async (data: PersonFormData) => {
    setIsSubmitting(true)
    try {
      if (addEditMode === 'create') {
        // Create new person
        const res = await fetch('/api/people', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: data.firstName,
            lastName: data.lastName,
            displayName: data.displayName,
            birthDate: data.birthDate,
            deathDate: data.deathDate,
            bio: data.bio,
            personType: data.personType,
          }),
        })
        if (!res.ok) throw new Error('Failed to create person')
      } else {
        // Update existing person
        if (!selectedPersonId) throw new Error('No person selected')
        const res = await fetch(`/api/people/${selectedPersonId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: data.firstName,
            lastName: data.lastName,
            displayName: data.displayName,
            birthDate: data.birthDate,
            deathDate: data.deathDate,
            bio: data.bio,
            personType: data.personType,
          }),
        })
        if (!res.ok) throw new Error('Failed to update person')
      }
      setAddEditModalOpen(false)
      // Refresh the page to show updated data
      window.location.reload()
    } catch (err) {
      console.error('Error saving person:', err)
      // Could show an error toast here
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePerson = async (personId: string) => {
    try {
      const res = await fetch(`/api/people/${personId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete person')
      setDetailModalOpen(false)
      // Refresh the page to show updated data
      window.location.reload()
    } catch (err) {
      console.error('Error deleting person:', err)
      // Could show an error toast here
    }
  }

  const handleAddStory = (personId: string) => {
    console.log('Add story for person:', personId)
    // TODO: Navigate to story creation with person pre-selected
  }

  const handleAddVoiceProfile = (personId: string) => {
    console.log('Add voice profile for person:', personId)
    // TODO: Open voice training modal with person pre-selected
  }

  const handleAddRelationship = (personId: string) => {
    onEditRelationships?.(personId)
  }

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.1, 1.8))
  }

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.1, 0.6))
  }

  const handlePan = (dx: number, dy: number) => {
    setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
  }

  const handleResetView = () => {
    setZoomLevel(1)
    setPanOffset({ x: 0, y: 0 })
  }

  const handleOpenRelationshipEditor = () => {
    const fallbackPersonId = selectedPersonId
      || (familyData.parents[0] ? String(familyData.parents[0].id) : null)
      || (familyData.children[0] ? String(familyData.children[0].id) : null)
      || (familyData.grandparents[0] ? String(familyData.grandparents[0].id) : null)

    if (fallbackPersonId) {
      handleAddRelationship(fallbackPersonId)
      return
    }

    handleAddPerson()
  }

  const handleStoryClick = (storyId: string) => {
    console.log('Navigate to story:', storyId)
    // TODO: Navigate to story detail page
  }

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (toolMode !== 'hand') return
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
    panStart.current = { ...panOffset }
  }, [toolMode, panOffset])

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setPanOffset({
      x: panStart.current.x + dx,
      y: panStart.current.y + dy,
    })
  }, [])

  const handleCanvasMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  const cardPositions: CardPosition[] = useMemo(() => {
    const buildRow = (
      generationPeople: TreePerson[],
      level: TreeNodeLevel,
      rowY: number,
      cardWidth: number,
      gap: number,
      cardHeight: number,
    ): CardPosition[] => {
      const rowWidth = getGenerationWidth(generationPeople.length, cardWidth, gap)
      const rowStartX = (treeCanvasWidth - rowWidth) / 2

      return generationPeople.map((person, index) => ({
        id: String(person.id),
        person,
        level,
        x: rowStartX + index * (cardWidth + gap),
        y: rowY,
        width: cardWidth,
        estimatedHeight: cardHeight,
      }))
    }

    return [
      ...buildRow(familyData.grandparents, 'grandparent', GRANDPARENT_ROW_Y, GRANDPARENT_CARD_WIDTH, GRANDPARENT_GAP, GRANDPARENT_CARD_HEIGHT),
      ...buildRow(familyData.parents, 'parent', PARENT_ROW_Y, PARENT_CARD_WIDTH, PARENT_GAP, PARENT_CARD_HEIGHT),
      ...buildRow(familyData.children, 'child', CHILD_ROW_Y, CHILD_CARD_WIDTH, CHILD_GAP, CHILD_CARD_HEIGHT),
    ]
  }, [familyData.grandparents, familyData.parents, familyData.children, treeCanvasWidth])

  useEffect(() => {
    if (!selectedSearchMemberId) return

    const card = cardPositions.find((c) => c.id === selectedSearchMemberId)
    if (!card) return

    const containerPadding = 160
    const targetX = treeCanvasWidth / 2 - (card.x + card.width / 2)
    const targetY = containerPadding - (card.y + card.estimatedHeight / 2)

    setPanOffset({ x: targetX, y: targetY })
  }, [selectedSearchMemberId, cardPositions, treeCanvasWidth])

  // Center on self card when entering fullscreen
  useEffect(() => {
    if (!isFullscreen) return
    const selfCard = cardPositions.find((c) => c.person.selected)
    if (!selfCard) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cardCenterX = selfCard.x + selfCard.width / 2
    const cardCenterY = selfCard.y + selfCard.estimatedHeight / 2
    setPanOffset({
      x: (vw / 2) - cardCenterX - 40,
      y: (vh / 2) - cardCenterY - 40,
    })
  }, [isFullscreen, cardPositions, treeCanvasWidth])

  const connectorPaths: ConnectorPath[] = useMemo(() => {
    const paths: ConnectorPath[] = []
    const cardById = new Map(cardPositions.map((c) => [c.id, c]))

    const getStyle = (kind: FamilyTreeRelationshipEdge['relationshipKind']) => {
      if (kind === 'biological') {
        return { stroke: CONNECTOR_BIOLOGICAL_COLOR, strokeWidth: CONNECTOR_THICKNESS }
      }
      return { stroke: CONNECTOR_NON_BIO_COLOR, strokeWidth: CONNECTOR_THICKNESS, strokeDasharray: '6 4' }
    }

    // --- Spouse connectors: horizontal line at vertical midpoint between two cards ---
    const spouseEdges = familyData.relationshipEdges.filter((e) => e.type === 'SPOUSE')
    for (const edge of spouseEdges) {
      const a = cardById.get(edge.sourceId)
      const b = cardById.get(edge.targetId)
      if (!a || !b) continue

      const left = a.x < b.x ? a : b
      const right = a.x < b.x ? b : a
      const midY = left.y + left.estimatedHeight / 2
      const x1 = left.x + left.width
      const x2 = right.x

      paths.push({
        id: edge.id,
        d: `M ${x1} ${midY} L ${x2} ${midY}`,
        stroke: CONNECTOR_SPOUSE_COLOR,
        strokeWidth: CONNECTOR_THICKNESS,
      })
    }

    // --- Parent-child connectors with proper T-junction pattern ---
    // Group parent-child edges into "family units" (parents who share children)
    const parentChildEdges = familyData.relationshipEdges
      .filter((e) => e.type === 'PARENT_CHILD')
      .filter((e) => cardById.has(e.sourceId) && cardById.has(e.targetId))

    // Build parent→children and child→parents maps
    const parentToChildren = new Map<string, Set<string>>()
    const childToParents = new Map<string, Set<string>>()
    const edgeKind = new Map<string, FamilyTreeRelationshipEdge['relationshipKind']>()

    for (const edge of parentChildEdges) {
      if (!parentToChildren.has(edge.sourceId)) parentToChildren.set(edge.sourceId, new Set())
      parentToChildren.get(edge.sourceId)!.add(edge.targetId)

      if (!childToParents.has(edge.targetId)) childToParents.set(edge.targetId, new Set())
      childToParents.get(edge.targetId)!.add(edge.sourceId)

      edgeKind.set(`${edge.sourceId}:${edge.targetId}`, edge.relationshipKind)
    }

    // Identify family units: group parents who are spouses and share children
    const spouseSet = new Set<string>()
    for (const edge of spouseEdges) {
      spouseSet.add(`${edge.sourceId}:${edge.targetId}`)
      spouseSet.add(`${edge.targetId}:${edge.sourceId}`)
    }

    const processedParents = new Set<string>()
    const familyUnits: { parentIds: string[]; childIds: string[]; isBiological: boolean }[] = []

    for (const parentId of Array.from(parentToChildren.keys())) {
      if (processedParents.has(parentId)) continue
      processedParents.add(parentId)

      const children = parentToChildren.get(parentId)!
      const unitParents = [parentId]

      // Find spouse who is also a parent of the same children
      for (const otherId of Array.from(parentToChildren.keys())) {
        if (otherId === parentId || processedParents.has(otherId)) continue
        const isSpouse = spouseSet.has(`${parentId}:${otherId}`)
        const otherChildren = parentToChildren.get(otherId)!
        const sharedChildren = Array.from(children).filter((c) => otherChildren.has(c))
        if (isSpouse || sharedChildren.length > 0) {
          unitParents.push(otherId)
          processedParents.add(otherId)
          // Merge children
          Array.from(otherChildren).forEach((c) => children.add(c))
        }
      }

      // Determine biological status (use most common)
      let bioCount = 0
      let totalCount = 0
      for (const pid of unitParents) {
        for (const cid of Array.from(children)) {
          const kind = edgeKind.get(`${pid}:${cid}`)
          if (kind) {
            totalCount++
            if (kind === 'biological') bioCount++
          }
        }
      }

      familyUnits.push({
        parentIds: unitParents,
        childIds: Array.from(children),
        isBiological: bioCount >= totalCount / 2,
      })
    }

    // Draw connectors for each family unit
    for (const unit of familyUnits) {
      const parentCards = unit.parentIds.map((id) => cardById.get(id)).filter(Boolean) as CardPosition[]
      const childCards = unit.childIds
        .map((id) => cardById.get(id))
        .filter(Boolean) as CardPosition[]

      if (parentCards.length === 0 || childCards.length === 0) continue

      const style = getStyle(unit.isBiological ? 'biological' : 'nonBiological')

      // Anchor point: midpoint between parents (bottom center)
      const allParentCentersX = parentCards.map((c) => c.x + c.width / 2)
      const anchorX = allParentCentersX.reduce((s, x) => s + x, 0) / allParentCentersX.length
      const anchorY = Math.max(...parentCards.map((c) => c.y + c.estimatedHeight))

      // Children top centers
      const childAnchors = childCards
        .map((c) => ({ x: c.x + c.width / 2, y: c.y }))
        .sort((a, b) => a.x - b.x)

      // Bus Y: midpoint between parent bottom and child top
      const childTopY = Math.min(...childAnchors.map((a) => a.y))
      const busY = Math.round((anchorY + childTopY) / 2)

      // Vertical stem from parent anchor to bus
      paths.push({
        id: `stem-down-${unit.parentIds.join('-')}`,
        d: `M ${anchorX} ${anchorY} L ${anchorX} ${busY}`,
        ...style,
      })

      if (childAnchors.length === 1) {
        // Single child: just continue the stem straight down
        paths.push({
          id: `stem-child-${unit.childIds[0]}`,
          d: `M ${anchorX} ${busY} L ${childAnchors[0].x} ${busY} L ${childAnchors[0].x} ${childAnchors[0].y}`,
          ...style,
        })
      } else {
        // Multiple children: horizontal bus + vertical stems
        const leftX = Math.min(...childAnchors.map((a) => a.x))
        const rightX = Math.max(...childAnchors.map((a) => a.x))

        // Horizontal bus
        paths.push({
          id: `bus-${unit.parentIds.join('-')}`,
          d: `M ${leftX} ${busY} L ${rightX} ${busY}`,
          ...style,
        })

        // Vertical stems from bus down to each child
        for (const child of childAnchors) {
          const childId = childCards.find((c) => Math.abs(c.x + c.width / 2 - child.x) < 1)?.id || 'unknown'
          const childKind = unit.parentIds
            .map((pid) => edgeKind.get(`${pid}:${childId}`))
            .find((k) => k !== undefined) || (unit.isBiological ? 'biological' : 'nonBiological')
          const childStyle = getStyle(childKind)

          paths.push({
            id: `stem-child-${childId}`,
            d: `M ${child.x} ${busY} L ${child.x} ${child.y}`,
            ...childStyle,
          })
        }
      }

      // Vertical stems from each parent down to anchor (if multiple parents)
      if (parentCards.length > 1) {
        for (const pc of parentCards) {
          const pcCenterX = pc.x + pc.width / 2
          const pcBottomY = pc.y + pc.estimatedHeight
          if (Math.abs(pcCenterX - anchorX) > 2) {
            paths.push({
              id: `stem-parent-${pc.id}`,
              d: `M ${pcCenterX} ${pcBottomY} L ${pcCenterX} ${anchorY} L ${anchorX} ${anchorY}`,
              ...style,
            })
          }
        }
      }
    }

    return paths
  }, [familyData.relationshipEdges, cardPositions])

  return (
    <Box
      sx={{
        bgcolor: 'rgba(208, 227, 230, 0.2)',
        p: isFullscreen ? 1 : { xs: 2, md: 3 },
        overflow: 'hidden',
        position: isFullscreen ? 'fixed' : 'relative',
        ...(isFullscreen && {
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1300,
        }),
      }}
    >
        <Box
          sx={{
            position: 'sticky',
            top: isFullscreen ? 8 : { xs: 72, md: 84 },
            zIndex: 25,
            pt: 0.5,
            pb: 1.5,
            mb: 1,
            background: 'linear-gradient(to bottom, rgba(246,243,238,0.95), rgba(246,243,238,0.65), rgba(246,243,238,0))',
            backdropFilter: 'blur(6px)',
          }}
        >
          {/* Search Panel */}
          <Box sx={{ maxWidth: 1200, mx: 'auto', mb: 2 }}>
            <Card
              sx={{
                p: 2,
                borderRadius: 4,
                bgcolor: 'rgba(255, 255, 255, 0.82)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 10px 40px rgba(28, 28, 25, 0.06)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Search sx={{ color: 'primary.main' }} />
                  <Typography sx={{ color: 'primary.main', fontWeight: 600 }}>
                    Family Member Search
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setIsSearchExpanded((prev) => !prev)}
                  endIcon={isSearchExpanded ? <ExpandLess /> : <ExpandMore />}
                  sx={{ textTransform: 'none', color: 'secondary.main' }}
                >
                  {isSearchExpanded ? 'Collapse' : 'Expand'}
                </Button>
              </Box>

              {isSearchExpanded && (
                <Box sx={{ mt: 2.5 }}>
                  <Box
                    component="input"
                    value={searchQuery}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
                    placeholder="Search by name or relationship"
                    sx={{
                      width: '100%',
                      border: 0,
                      outline: 0,
                      bgcolor: '#ebe8e3',
                      borderRadius: 2,
                      px: 2,
                      py: 1.5,
                      fontSize: '0.95rem',
                      color: '#1c1c19',
                      transition: 'all 0.2s ease',
                      '&:focus': {
                        bgcolor: '#ffffff',
                        boxShadow: '0 0 0 1px rgba(22, 51, 74, 0.2)',
                      },
                    }}
                  />

                  {selectedSearchMember && (
                    <Box sx={{ mt: 1.5 }}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => setSelectedSearchMemberId(null)}
                        sx={{
                          textTransform: 'none',
                          borderRadius: 99,
                          px: 2,
                        }}
                      >
                        Selected: {selectedSearchMember.name} ({selectedSearchMember.relationship})
                      </Button>
                    </Box>
                  )}

                  {debouncedSearchQuery.trim() && (
                    <Box sx={{ mt: 2, maxHeight: 280, overflowY: 'auto', pr: 0.5 }}>
                      {filteredSearchResults.length === 0 ? (
                        <Typography variant="body2" sx={{ color: 'secondary.main' }}>
                          No matching family members found.
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {filteredSearchResults.map((member) => (
                            <Button
                              key={member.id}
                              variant="text"
                              onClick={() => setSelectedSearchMemberId(member.id)}
                              sx={{
                                justifyContent: 'flex-start',
                                textTransform: 'none',
                                borderRadius: 2,
                                p: 1,
                                color: 'inherit',
                                bgcolor: selectedSearchMemberId === member.id ? 'rgba(22, 51, 74, 0.08)' : 'transparent',
                                '&:hover': { bgcolor: 'rgba(22, 51, 74, 0.06)' },
                              }}
                            >
                              <Avatar src={member.avatar} sx={{ width: 36, height: 36, mr: 1.5 }} />
                              <Box sx={{ textAlign: 'left' }}>
                                <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>
                                  {member.name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'secondary.main' }}>
                                  {member.relationship}
                                </Typography>
                              </Box>
                            </Button>
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              )}
            </Card>
          </Box>

          {/* Control Bar */}
          <Box
            sx={{
              maxWidth: 1200,
              mx: 'auto',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                bgcolor: 'background.paper',
                px: 1,
                py: 0.5,
                borderRadius: 8,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: '1px solid',
                borderColor: 'rgba(208, 227, 230, 0.5)',
              }}
            >
            <IconButton
              size="small"
              onClick={() => setToolMode('pointer')}
              sx={{
                color: toolMode === 'pointer' ? 'white' : 'primary.main',
                bgcolor: toolMode === 'pointer' ? 'primary.main' : 'transparent',
                '&:hover': { bgcolor: toolMode === 'pointer' ? 'primary.dark' : 'rgba(22, 51, 74, 0.08)' },
              }}
              title="Pointer tool"
            >
              <NearMe sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setToolMode('hand')}
              sx={{
                color: toolMode === 'hand' ? 'white' : 'primary.main',
                bgcolor: toolMode === 'hand' ? 'primary.main' : 'transparent',
                '&:hover': { bgcolor: toolMode === 'hand' ? 'primary.dark' : 'rgba(22, 51, 74, 0.08)' },
              }}
              title="Hand tool (drag to pan)"
            >
              <PanTool sx={{ fontSize: 18 }} />
            </IconButton>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }} />
            <IconButton size="small" sx={{ color: 'primary.main' }} onClick={handleZoomIn}>
              <ZoomIn />
            </IconButton>
            <IconButton size="small" sx={{ color: 'primary.main' }} onClick={handleZoomOut}>
              <ZoomOut />
            </IconButton>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }} />
            <Button
              startIcon={<PersonAdd />}
              size="small"
              onClick={handleOpenRelationshipEditor}
              sx={{ color: 'primary.main', textTransform: 'none' }}
            >
              Edit Relationships
            </Button>
            <Button
              startIcon={<RestartAlt />}
              size="small"
              onClick={handleResetView}
              sx={{ color: 'primary.main', textTransform: 'none' }}
            >
              Reset View
            </Button>
            {onToggleFullscreen && (
              <>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }} />
                <IconButton
                  size="small"
                  onClick={onToggleFullscreen}
                  sx={{ color: 'primary.main' }}
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                </IconButton>
              </>
            )}
          </Box>
        </Box>
      </Box>

        {/* Family Tree Visualization */}
        <Box
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          sx={{
            position: 'relative',
            minHeight: isFullscreen ? 'calc(100vh - 140px)' : 700,
            width: '100%',
            bgcolor: 'rgba(208, 227, 230, 0.3)',
            borderRadius: 6,
            p: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            cursor: toolMode === 'hand' ? 'grab' : 'default',
            '&:active': toolMode === 'hand' ? { cursor: 'grabbing' } : {},
            userSelect: toolMode === 'hand' ? 'none' : 'auto',
            backgroundImage: `
              radial-gradient(circle, rgba(22, 51, 74, 0.06) 1px, transparent 1px)
            `,
            backgroundSize: '24px 24px',
          }}
        >
          <Box
            sx={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: isDragging.current ? 'none' : 'transform 0.2s ease',
              width: `max(${treeCanvasWidth + 80}px, 100%)`,
              minHeight: TREE_FLOW_HEIGHT,
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                height: TREE_FLOW_HEIGHT,
              }}
            >
              {/* SVG connector overlay */}
              <svg
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              >
                {connectorPaths.map((path) => (
                  <path
                    key={path.id}
                    d={path.d}
                    stroke={path.stroke}
                    strokeWidth={path.strokeWidth}
                    strokeDasharray={path.strokeDasharray}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>

              {/* Absolutely positioned family member cards */}
              {cardPositions.map((card) => (
                <Box
                  key={card.id}
                  sx={{
                    position: 'absolute',
                    left: card.x,
                    top: card.y,
                    zIndex: 2,
                  }}
                >
                  <FamilyMemberCard
                    person={card.person}
                    level={card.level}
                    isSelf={card.person.selected}
                    onPersonClick={handlePersonClick}
                    onAddPerson={handleAddPerson}
                  />
                </Box>
              ))}

            </Box>

            {/* Add Relative Button */}
            <Box sx={{ mt: 6, cursor: 'pointer', display: 'flex', justifyContent: 'center' }} onClick={handleAddPerson}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    bgcolor: 'rgba(208, 227, 230, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'secondary.main',
                    transition: 'all 0.3s',
                    '&:hover': {
                      bgcolor: 'primary.main',
                      color: 'white',
                    },
                  }}
                >
                  <Add />
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    mt: 1,
                    fontWeight: 700,
                    color: 'secondary.main',
                    opacity: 0.6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  Add Relative
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Legend + Insights Sidebar */}
        <Box
          sx={{
            position: 'absolute',
            right: 48,
            top: 80,
            display: { xs: 'none', xl: 'flex' },
            flexDirection: 'column',
            gap: 2,
            zIndex: 10,
          }}
        >
          {/* Connection Legend */}
          <Card
            sx={{
              width: 320,
              px: 2,
              py: 1.5,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.88)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(22, 51, 74, 0.10)',
              boxShadow: '0 4px 16px rgba(22, 51, 74, 0.08)',
              transition: 'all 0.2s ease',
            }}
          >
            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => setLegendCollapsed((prev) => !prev)}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
                Legend
              </Typography>
              <IconButton size="small" sx={{ p: 0, ml: 1, color: 'secondary.main' }}>
                {legendCollapsed ? <ExpandMore sx={{ fontSize: 16 }} /> : <ExpandLess sx={{ fontSize: 16 }} />}
              </IconButton>
            </Box>
            {!legendCollapsed && (
              <Box sx={{ mt: 0.75 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75 }}>
                  <Box sx={{ width: 26, height: CONNECTOR_THICKNESS, bgcolor: CONNECTOR_BIOLOGICAL_COLOR }} />
                  <Typography variant="caption" sx={{ color: 'secondary.main' }}>Biological parent-child</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75 }}>
                  <Box sx={{ width: 26, borderTop: `${CONNECTOR_THICKNESS}px dashed ${CONNECTOR_NON_BIO_COLOR}` }} />
                  <Typography variant="caption" sx={{ color: 'secondary.main' }}>Adopted/step/in-law parent-child</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box sx={{ width: 26, height: CONNECTOR_THICKNESS, bgcolor: CONNECTOR_SPOUSE_COLOR }} />
                  <Typography variant="caption" sx={{ color: 'secondary.main' }}>Spouse</Typography>
                </Box>
              </Box>
            )}
          </Card>

          {/* Detail Sidebar */}
          <Card
            sx={{
            width: insightCollapsed ? 'auto' : 320,
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(20px)',
            p: insightCollapsed ? 2 : 4,
            borderRadius: 8,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
            border: '1px solid',
            borderColor: 'rgba(255,255,255,0.5)',
            transition: 'all 0.2s ease',
          }}
        >
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', mb: insightCollapsed ? 0 : 3 }}
            onClick={() => setInsightCollapsed((prev) => !prev)}
          >
            <Box>
              <Typography
                variant="overline"
                sx={{
                  color: 'secondary.main',
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  fontSize: '0.65rem',
                }}
              >
                INSIGHT
              </Typography>
              {!insightCollapsed && (
                <Typography
                  variant="h5"
                  sx={{
                    fontFamily: 'var(--font-newsreader), serif',
                    color: 'primary.main',
                    mt: 0.5,
                  }}
                >
                  Common Threads
                </Typography>
              )}
            </Box>
            <IconButton size="small" sx={{ color: 'secondary.main' }}>
              {insightCollapsed ? <ExpandMore /> : <ExpandLess />}
            </IconButton>
          </Box>

          {!insightCollapsed && (
            <>
              <Box sx={{ spaceY: 3 }}>
                <Card
                  sx={{
                    bgcolor: 'rgba(208, 227, 230, 0.3)',
                    p: 3,
                    borderRadius: 4,
                    mb: 3,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'secondary.main',
                      fontStyle: 'italic',
                    }}
                  >
                    &quot;Most family stories reference &apos;The Summer of &apos;84&apos; at the lake house.&quot;
                  </Typography>
                </Card>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1, mb: 2 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: 'tertiary.main',
                    }}
                  />
                  <Typography variant="body2" sx={{ color: 'secondary.main' }}>
                    3 Shared voice patterns found
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: 'rgba(22, 51, 74, 0.5)',
                    }}
                  />
                  <Typography variant="body2" sx={{ color: 'secondary.main' }}>
                    Genealogy sync active
                  </Typography>
                </Box>
              </Box>

              <Button
                fullWidth
                variant="contained"
                endIcon={<AutoFixHigh />}
                sx={{
                  mt: 4,
                  py: 1.5,
                  borderRadius: 3,
                }}
              >
                Generate Family Bio
              </Button>
            </>
          )}
        </Card>
        </Box>

      {/* Person Detail Modal */}
      <PersonDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        person={personDetail}
        stories={personStories}
        isLoading={isLoadingDetail}
        error={detailError}
        onEdit={handleEditPerson}
        onDelete={handleDeletePerson}
        onAddStory={handleAddStory}
        onAddVoiceProfile={handleAddVoiceProfile}
        onAddRelationship={handleAddRelationship}
        onStoryClick={handleStoryClick}
      />

      {/* Add/Edit Person Modal - Only for editing existing people */}
      {addEditMode === 'edit' && (
        <AddEditPersonModal
          open={addEditModalOpen}
          onClose={() => setAddEditModalOpen(false)}
          mode={addEditMode}
          person={addEditMode === 'edit' && personDetail ? {
            firstName: personDetail.firstName,
            lastName: personDetail.lastName,
            displayName: personDetail.displayName,
            birthDate: personDetail.birthDate?.split('T')[0],
            deathDate: personDetail.deathDate?.split('T')[0],
            bio: personDetail.bio,
            personType: personDetail.personType,
          } : undefined}
          onSubmit={handleSubmitPerson}
          isSubmitting={isSubmitting}
        />
      )}
    </Box>
  )
}
