import React, { useMemo, useRef, useEffect } from 'react'
import {
  Box,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import { SearchableFamilyMember } from '@/components/search'
import { useFamilyTree } from './family-tree/useFamilyTree'
import { FamilyTreeControls } from './family-tree/FamilyTreeControls'
import { TopolaTreeCanvas } from './family-tree/topola/TopolaTreeCanvas'
import { FamilyTreeModals } from './family-tree/FamilyTreeModals'
import { FamilyTreeSidebar } from './family-tree/FamilyTreeSidebar'
import { FamilyTreeSearchOverlay } from './family-tree/FamilyTreeSearchOverlay'

import { TreePerson, FamilyTreeData } from './family-tree/types'

import { ApiPersonWithEdges } from './family-tree/topola/adapters/HeardAgainDataAdapter'

interface FamilyTreePageProps {
  people?: FamilyTreeData
  rawPeople?: ApiPersonWithEdges[]
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
  onLoadMore?: (direction: 'up' | 'down') => void
  onToggleSiblings?: () => void
  onSetRoot?: (id: string) => void
  includeSiblings?: boolean
  loadedDepths?: { up: number; down: number }
  isLoadingMore?: boolean
}

const defaultFamilyData: FamilyTreeData = {
  generations: {},
  relationshipEdges: [],
}

export function FamilyTreePage({
  people,
  rawPeople,
  onPersonClick,
  onAddPerson,
  onEditRelationships,
  onPeopleChanged,
  isFullscreen = false,
  onToggleFullscreen,
  onImportGedcom,
  onExportGedcom,
  onLoadMore,
  onToggleSiblings,
  onSetRoot,
  includeSiblings = false,
  loadedDepths = { up: 2, down: 2 },
  isLoadingMore = false,
}: FamilyTreePageProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const familyData = people && people.generations
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

  const searchableMembers = useMemo<SearchableFamilyMember[]>(() => {
    const normalize = (person: TreePerson): SearchableFamilyMember => ({
      id: String(person.id),
      name: person.name,
      relationship: person.role,
      avatar: person.avatar,
    })

    return Object.values(familyData.generations || {}).flat().map(normalize)
  }, [familyData.generations])

  const [selectedSearchMemberId, setSelectedSearchMemberId] = React.useState<string | null>(null)

// Side effects
useEffect(() => {
  if (!selectedSearchMemberId) return

  // In Topola, we change the root person (focal-point transition)
  if (onSetRoot) {
    onSetRoot(selectedSearchMemberId)
  }
}, [selectedSearchMemberId, onSetRoot])

useEffect(() => {
  if (isMobile) setZoomLevel(0.75)
}, [isMobile, setZoomLevel])

useEffect(() => {
  if (!isFullscreen) return
  setPanOffset({ x: 0, y: 0 })
}, [isFullscreen, zoomLevel, setPanOffset])


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
        onToggleSiblings={onToggleSiblings}
        includeSiblings={includeSiblings}
      />

      <TopolaTreeCanvas
        people={rawPeople || []}
        rootPersonId={familyData.rootPersonId}
        isFullscreen={isFullscreen}
        isMobile={isMobile}
        zoomLevel={zoomLevel}
        panOffset={panOffset}
        toolMode={toolMode}
        isDragging={isDragging}
        onCanvasMouseDown={handleCanvasMouseDown}
        onCanvasMouseMove={handleCanvasMouseMove}
        onCanvasMouseUp={handleCanvasMouseUp}
        onCanvasTouchStart={handleCanvasTouchStart}
        onCanvasTouchMove={handleCanvasTouchMove}
        onCanvasTouchEnd={handleCanvasTouchEnd}
        onPersonClick={handlePersonClick}
        onAddPerson={handleAddPerson}
        onViewArchive={handleViewArchive}
        onLoadMore={onLoadMore}
        onToggleSiblings={onToggleSiblings}
        loadedDepths={loadedDepths}
        isLoadingMore={isLoadingMore}
        includeSiblings={includeSiblings}
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
