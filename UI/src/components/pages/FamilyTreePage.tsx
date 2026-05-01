import React, { useMemo, useRef, useEffect } from 'react'
import {
  Box,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import { SearchableFamilyMember } from '@/components/search'
import { useFamilyTree } from './family-tree/useFamilyTree'
import { FamilyTreeControls } from './family-tree/FamilyTreeControls'
import { FamilyTreeCanvas } from './family-tree/FamilyTreeCanvas'
import { FamilyTreeModals } from './family-tree/FamilyTreeModals'
import { FamilyTreeSidebar } from './family-tree/FamilyTreeSidebar'
import { FamilyTreeSearchOverlay } from './family-tree/FamilyTreeSearchOverlay'
import { TreePerson, FamilyTreeData } from './family-tree/types'
import {
  calculateCardPositions,
  calculateConnectorPaths,
  getGenerationWidth,
  GRANDPARENT_CARD_WIDTH,
  GRANDPARENT_GAP,
  PARENT_CARD_WIDTH,
  PARENT_GAP,
  CHILD_CARD_WIDTH,
  CHILD_GAP,
  GRANDPARENT_CARD_HEIGHT,
  PARENT_CARD_HEIGHT,
  CHILD_CARD_HEIGHT,
} from './family-tree/layout-utils'

interface FamilyTreePageProps {
  people?: FamilyTreeData
  onPersonClick?: (person: TreePerson) => void
  onAddPerson?: () => void
  onEditRelationships?: (personId: string) => void
  onPeopleChanged?: () => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  initialSearchExpanded?: boolean
  initialSearchQuery?: string
  onImportGedcom?: () => void
  onExportGedcom?: () => void
}

const defaultFamilyData: FamilyTreeData = {
  grandparents: [],
  parents: [],
  children: [],
  relationshipEdges: [],
}

export function FamilyTreePage({
  people,
  onPersonClick,
  onAddPerson,
  onEditRelationships,
  onPeopleChanged,
  isFullscreen = false,
  onToggleFullscreen,
  onImportGedcom,
  onExportGedcom,
}: FamilyTreePageProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const familyData = people && (people.grandparents.length > 0 || people.parents.length > 0 || people.children.length > 0)
    ? people
    : defaultFamilyData

  const {
    // View state
    zoomLevel,
    setZoomLevel,
    panOffset,
    setPanOffset,
    toolMode,
    setToolMode,
    isDragging,
    
    // Modal state
    detailModalOpen,
    setDetailModalOpen,
    addEditModalOpen,
    setAddEditModalOpen,
    addEditMode,
    selectedPersonId,
    isSubmitting,
    
    // Sidebar state
    legendCollapsed,
    setLegendCollapsed,
    
    // Detail data
    personDetail,
    personStories,
    personVoiceProfiles,
    personRelationships,
    isLoadingDetail,
    detailError,
    
    // Voice training
    voiceTrainingPersonId,
    setVoiceTrainingPersonId,
    
    // Search
    searchOverlayOpen,
    setSearchOverlayOpen,
    overlayQuery,
    setOverlayQuery,
    
    // Handlers
    handlePersonClick,
    handleAddPerson,
    handleEditPerson,
    handleSubmitPerson,
    handleDeletePerson,
    handleAddStory,
    handleAddVoiceProfile,
    handleAddRelationship,
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    handleOpenRelationshipEditor,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleCanvasTouchStart,
    handleCanvasTouchMove,
    handleCanvasTouchEnd,
    handleViewArchive,
  } = useFamilyTree(familyData, onPersonClick, onAddPerson, onEditRelationships, onPeopleChanged)

  const overlayInputRef = useRef<HTMLInputElement>(null)

  // Layout calculations
  const cardW = {
    grandparent: isMobile ? 140 : GRANDPARENT_CARD_WIDTH,
    parent: isMobile ? 160 : PARENT_CARD_WIDTH,
    child: isMobile ? 130 : CHILD_CARD_WIDTH,
  }
  const cardGap = {
    grandparent: isMobile ? 16 : GRANDPARENT_GAP,
    parent: isMobile ? 16 : PARENT_GAP,
    child: isMobile ? 16 : CHILD_GAP,
  }

  const parentRowWidth = getGenerationWidth(familyData.parents.length, cardW.parent, cardGap.parent)
  const grandparentRowWidth = getGenerationWidth(familyData.grandparents.length, cardW.grandparent, cardGap.grandparent)
  const childrenRowWidth = getGenerationWidth(familyData.children.length, cardW.child, cardGap.child)

  const treeCanvasWidth = Math.max(
    grandparentRowWidth,
    parentRowWidth,
    childrenRowWidth,
    cardW.parent,
  )

  const treeFlowHeight = familyData.children.length > 0
    ? (isMobile ? 480 : 900)
    : (isMobile ? 280 : 520)

  const cardPositions = useMemo(() => 
    calculateCardPositions(familyData, isMobile, treeCanvasWidth),
    [familyData, isMobile, treeCanvasWidth]
  )

  const connectorPaths = useMemo(() => 
    calculateConnectorPaths(familyData, cardPositions),
    [familyData, cardPositions]
  )

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
  }, [familyData])

  const [selectedSearchMemberId, setSelectedSearchMemberId] = React.useState<string | null>(null)

  // Side effects
  useEffect(() => {
    if (!selectedSearchMemberId) return

    const card = cardPositions.find((c) => c.id === selectedSearchMemberId)
    if (!card) return

    const containerPadding = 160
    const targetX = treeCanvasWidth / 2 - (card.x + card.width / 2)
    const targetY = containerPadding - (card.y + card.estimatedHeight / 2)

    setPanOffset({ x: targetX, y: targetY })
  }, [selectedSearchMemberId, cardPositions, treeCanvasWidth, setPanOffset])

  useEffect(() => {
    if (isMobile) setZoomLevel(0.75)
  }, [isMobile, setZoomLevel])

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
  }, [isFullscreen, cardPositions, treeCanvasWidth, setPanOffset])

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
      <FamilyTreeControls
        isFullscreen={isFullscreen}
        isMobile={isMobile}
        toolMode={toolMode}
        setToolMode={setToolMode}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onOpenSearch={() => {
          setSearchOverlayOpen(true)
          setOverlayQuery('')
          setTimeout(() => overlayInputRef.current?.focus(), 60)
        }}
        onOpenRelationshipEditor={handleOpenRelationshipEditor}
        onToggleFullscreen={onToggleFullscreen}
        onImportGedcom={onImportGedcom}
        onExportGedcom={onExportGedcom}
      />

      <FamilyTreeCanvas
        familyData={familyData}
        isFullscreen={isFullscreen}
        isMobile={isMobile}
        treeCanvasWidth={treeCanvasWidth}
        treeFlowHeight={treeFlowHeight}
        zoomLevel={zoomLevel}
        panOffset={panOffset}
        toolMode={toolMode}
        isDragging={isDragging}
        connectorPaths={connectorPaths}
        cardPositions={cardPositions}
        onCanvasMouseDown={handleCanvasMouseDown}
        onCanvasMouseMove={handleCanvasMouseMove}
        onCanvasMouseUp={handleCanvasMouseUp}
        onCanvasTouchStart={handleCanvasTouchStart}
        onCanvasTouchMove={handleCanvasTouchMove}
        onCanvasTouchEnd={handleCanvasTouchEnd}
        onPersonClick={handlePersonClick}
        onAddPerson={handleAddPerson}
        onViewArchive={handleViewArchive}
      />

      <FamilyTreeSidebar
        legendCollapsed={legendCollapsed}
        setLegendCollapsed={setLegendCollapsed}
      />

      <FamilyTreeSearchOverlay
        open={searchOverlayOpen}
        onClose={() => setSearchOverlayOpen(false)}
        query={overlayQuery}
        setQuery={setOverlayQuery}
        searchableMembers={searchableMembers}
        onMemberSelect={setSelectedSearchMemberId}
        inputRef={overlayInputRef}
      />

      <FamilyTreeModals
        detailModalOpen={detailModalOpen}
        setDetailModalOpen={setDetailModalOpen}
        addEditModalOpen={addEditModalOpen}
        setAddEditModalOpen={setAddEditModalOpen}
        addEditMode={addEditMode}
        selectedPersonId={selectedPersonId}
        personDetail={personDetail}
        personStories={personStories}
        personVoiceProfiles={personVoiceProfiles}
        personRelationships={personRelationships}
        isLoadingDetail={isLoadingDetail}
        detailError={detailError}
        isSubmitting={isSubmitting}
        voiceTrainingPersonId={voiceTrainingPersonId}
        setVoiceTrainingPersonId={setVoiceTrainingPersonId}
        onEditPerson={handleEditPerson}
        onDeletePerson={handleDeletePerson}
        onAddStory={handleAddStory}
        onAddVoiceProfile={handleAddVoiceProfile}
        onAddRelationship={handleAddRelationship}
        onStoryClick={(id) => {
          if (id) window.location.href = `/stories/${id}`
        }}
        onViewFullProfile={(id) => {
          window.location.href = `/profile/${id}`
        }}
        onSubmitPerson={handleSubmitPerson}
      />
    </Box>
  )
}
