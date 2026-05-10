import React, { useMemo, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import {
  Box,
  Typography,
  Button,
  Card,
  Divider,
  IconButton,
  useTheme,
  useMediaQuery,
  Dialog,
  CircularProgress,
} from '@mui/material'
import {
  ZoomIn,
  ZoomOut,
  RestartAlt,
  Add,
  AutoFixHigh,
  PersonAdd,
  NearMe,
  PanTool,
  Fullscreen,
  FullscreenExit,
  ExpandMore,
  ExpandLess,
  People,
  UnfoldMore,
  Upload,
  Download,
  AccountCircle,
  Search,
  Close,
} from '@mui/icons-material'
import { PersonDetailModal } from '@/components/modals/PersonDetailModal'
import { AddEditPersonModal, PersonFormData } from '@/components/modals/AddEditPersonModal'
import { FamilyMemberSearch, SearchableFamilyMember } from '@/components/search'
import { fetchWithCSRFAndJSON, fetchWithCSRF } from '@/lib/api-client'
import { ReactFlowTreeCanvas, ReactFlowTreeCanvasHandle } from '@/components/pages/family-tree/xyflow/ReactFlowTreeCanvas'
import type { ApiPersonWithEdges, TreeLayoutPerson } from '@/components/pages/family-tree/xyflow/types'
import type { PersonType } from '@/contracts'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'

const CONNECTOR_BIOLOGICAL_COLOR = 'rgba(22, 51, 74, 0.52)'
const CONNECTOR_NON_BIO_COLOR = 'rgba(22, 51, 74, 0.35)'
const CONNECTOR_SPOUSE_COLOR = 'rgba(22, 51, 74, 0.34)'
const CONNECTOR_THICKNESS = 3

// ─── Props ────────────────────────────────────────────────────────────────────

interface FamilyTreePageProps {
  /** Legacy mapped data — unused by canvas, kept for prop compatibility */
  people?: unknown
  /** Raw API data — drives the @xyflow/react canvas and search overlay */
  rawPeople?: ApiPersonWithEdges[]
  /** All people in the familyspace for global search */
  searchablePeople?: any[]
  rootPersonId?: string
  onPersonClick?: (person: { id: string | number; name: string; avatar: string }) => void
  onAddPerson?: () => void
  onEditRelationships?: (personId: string) => void
  onPeopleChanged?: () => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onImportGedcom?: () => void
  onExportGedcom?: () => void
  onLoadMore?: (direction: 'up' | 'down' | 'left' | 'right', personId: string) => void
  onToggleSiblings?: () => void
  onExpandDepth?: () => void
  onSetRoot?: (id: string) => void
  includeSiblings?: boolean
  loadedDepths?: { up: number; down: number }
  isLoadingMore?: boolean
  initialSearchExpanded?: boolean
  initialSearchQuery?: string
  fitViewTrigger?: number
  familyBio?: string | null
  onGenerateBio?: () => Promise<void>
  isGeneratingBio?: boolean
  userPersonId?: string | null
  onViewFullProfile?: (personId: string) => void
}


// ─── Component ────────────────────────────────────────────────────────────────

export function FamilyTreePage({
  people: _people,
  rawPeople = [],
  searchablePeople = [],
  rootPersonId,
  onPeopleChanged: _onPeopleChanged,
  onImportGedcom,
  onExportGedcom,
  onLoadMore: _onLoadMore,
  onToggleSiblings,
  onExpandDepth,
  onSetRoot,
  includeSiblings = false,
  loadedDepths,
  isLoadingMore: _isLoadingMore,
  onPersonClick,
  onAddPerson,
  onEditRelationships,
  isFullscreen = false,
  onToggleFullscreen,
  initialSearchExpanded = false,
  fitViewTrigger,
  familyBio,
  onGenerateBio,
  isGeneratingBio = false,
  userPersonId,
  onViewFullProfile,
}: FamilyTreePageProps): React.JSX.Element {
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { setSelectedFamilyMember } = useSelectedFamilyMember()

  // Derive rootPersonId from rawPeople if not supplied by the page
  const effectiveRootId: string = useMemo(() => {
    if (rootPersonId) return rootPersonId
    const newest = [...rawPeople].sort((a, b) => {
      const aTime = a.birthDate ? new Date(a.birthDate).getTime() : 0
      const bTime = b.birthDate ? new Date(b.birthDate).getTime() : 0
      if (!isNaN(aTime) && !isNaN(bTime)) return bTime - aTime // descending
      return 0
    })[0]
    return newest ? newest.id : ''
  }, [rootPersonId, rawPeople])

  // Canvas ref for zoom/pan controls
  const canvasRef = useRef<ReactFlowTreeCanvasHandle>(null)

  // Modal states
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [addEditModalOpen, setAddEditModalOpen] = useState(false)
  const [addEditMode, setAddEditMode] = useState<'create' | 'edit'>('create')
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [legendCollapsed, setLegendCollapsed] = useState(false)
  const [insightCollapsed, setInsightCollapsed] = useState(false)
  const [selectedSearchMemberId, setSelectedSearchMemberId] = useState<string | null>(null)
  const [isPanMode] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)

  // Data states
  const [personDetail, setPersonDetail] = useState<Record<string, unknown> | null>(null)
  const [personStories, setPersonStories] = useState<unknown[]>([])
  const [personVoiceProfiles, setPersonVoiceProfiles] = useState<unknown[]>([])
  const [personRelationships, setPersonRelationships] = useState<unknown[]>([])
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Search overlay members — derived from search results if searching, else searchablePeople, else rawPeople
  const searchableMembers = useMemo<SearchableFamilyMember[]>(() => {
    const source = searchResults.length > 0 ? searchResults : (searchablePeople.length > 0 ? searchablePeople : rawPeople)
    return source.map((p) => ({
      id: p.id,
      name: p.displayName || `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`,
      relationship: 'Family Member',
      avatar: p.avatarUrl || (p as any).avatar || '',
    }))
  }, [searchResults, searchablePeople, rawPeople])

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleRemoteSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const res = await fetch(`/api/people?search=${encodeURIComponent(query)}&limit=20`, { credentials: 'include' })
      const data = await res.json()
      if (data.success && data.data) {
        setSearchResults(data.data)
      }
    } catch (err) {
      console.error('Remote search failed:', err)
    } finally {
      setIsSearching(false)
    }
  }, [])

  const handleFindMe = useCallback(() => {
    if (effectiveRootId) {
      // If root is already loaded, center on it
      const isCurrentlyVisible = rawPeople.some(p => p.id === effectiveRootId)
      if (isCurrentlyVisible) {
        canvasRef.current?.centerOnNode(effectiveRootId, { zoom: 1 })
      } else {
        // Otherwise, reset root to effective root (usually the user's node)
        onSetRoot?.(effectiveRootId)
      }
    }
  }, [effectiveRootId, rawPeople, onSetRoot])

  const handlePersonClick = useCallback(
    async (person: TreeLayoutPerson) => {
      setSelectedPersonId(String(person.id))
      setDetailModalOpen(true)
      onPersonClick?.({ id: person.id, name: person.name, avatar: person.avatar })

      setIsLoadingDetail(true)
      setDetailError(null)
      try {
        const [personRes, storiesRes, relationshipsRes] = await Promise.all([
          fetch(`/api/people/${person.id}`, { credentials: 'include' }),
          fetch(`/api/stories?subjectId=${person.id}&limit=20`, { credentials: 'include' }),
          fetch(`/api/people/${person.id}/relationships`, { credentials: 'include' }),
        ])

        const personData = (await personRes.json()) as {
          success: boolean
          data: Record<string, unknown>
          error?: string
        }
        const storiesData = (await storiesRes.json()) as {
          data?: { stories?: unknown[] }
        }
        const relationshipsData = (await relationshipsRes.json()) as { data?: unknown[] }

        if (personData.success) {
          setPersonDetail(personData.data)
          setPersonStories(storiesData.data?.stories ?? [])
          setPersonVoiceProfiles(
            (personData.data.voiceProfiles as unknown[]) ?? [],
          )
          setPersonRelationships(relationshipsData.data ?? [])
        } else {
          setDetailError(personData.error ?? 'Failed to load person details')
        }
      } catch {
        setDetailError('Failed to load person details')
      } finally {
        setIsLoadingDetail(false)
      }
    },
    [onPersonClick],
  )

  const handleViewMemories = useCallback(
    (person: TreeLayoutPerson) => {
      setSelectedFamilyMember({
        id: String(person.id),
        firstName: person.name.split(' ')[0] || '',
        lastName: person.name.split(' ').slice(1).join(' ') || undefined,
        displayName: person.name,
        avatarUrl: person.avatar || undefined,
      })
      router.push(`/profile/${person.id}`)
    },
    [router, setSelectedFamilyMember],
  )

  const handleAddPerson = useCallback(() => {
    onAddPerson?.()
  }, [onAddPerson])

  const handleEditPerson = useCallback(() => {
    setDetailModalOpen(false)
    setAddEditMode('edit')
    setAddEditModalOpen(true)
  }, [])

  const handleSubmitPerson = useCallback(
    async (data: PersonFormData) => {
      setIsSubmitting(true)
      try {
        if (addEditMode === 'create') {
          const res = await fetchWithCSRFAndJSON('/api/people', {
            firstName: data.firstName,
            lastName: data.lastName,
            displayName: data.displayName,
            birthDate: data.birthDate,
            deathDate: data.deathDate,
            bio: data.bio,
            personType: data.personType,
          })
          if (!res.ok) throw new Error('Failed to create person')
        } else {
          if (!selectedPersonId) throw new Error('No person selected')
          const res = await fetchWithCSRFAndJSON(`/api/people/${selectedPersonId}`, {
            firstName: data.firstName,
            lastName: data.lastName,
            displayName: data.displayName,
            birthDate: data.birthDate,
            deathDate: data.deathDate,
            bio: data.bio,
            personType: data.personType,
          })
          if (!res.ok) throw new Error('Failed to update person')
        }
        setAddEditModalOpen(false)
        window.location.reload()
      } catch {
        // error is surfaced by modal state
      } finally {
        setIsSubmitting(false)
      }
    },
    [addEditMode, selectedPersonId],
  )

  const handleDeletePerson = useCallback(async (personId: string) => {
    try {
      const res = await fetchWithCSRF(`/api/people/${personId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete person')
      setDetailModalOpen(false)
      window.location.reload()
    } catch {
      // error is surfaced by modal state
    }
  }, [])

  const handleAddStory = useCallback((personId: string) => {
    router.push(`/stories/contribute?subjectId=${personId}`)
  }, [router])

  const handleAddVoiceProfile = useCallback((_personId: string) => {
    // Open voice training modal with person pre-selected
  }, [])

  const handleAddRelationship = useCallback(
    (personId: string) => {
      onEditRelationships?.(personId)
    },
    [onEditRelationships],
  )

  const handleOpenRelationshipEditor = useCallback(() => {
    const fallbackPersonId = selectedPersonId ?? (rawPeople[0] ? rawPeople[0].id : null)
    if (fallbackPersonId) {
      handleAddRelationship(fallbackPersonId)
    } else {
      handleAddPerson()
    }
  }, [selectedPersonId, rawPeople, handleAddRelationship, handleAddPerson])

  const handleStoryClick = useCallback((_storyId: string) => {
    // Navigate to story detail page
  }, [])

  const handleViewFullProfile = useCallback(
    (personId: string) => {
      const p = rawPeople.find(rp => rp.id === personId)
      if (p) {
        setSelectedFamilyMember({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName || undefined,
          displayName: p.displayName || `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`,
          avatarUrl: p.avatarUrl || undefined,
        })
      }
      router.push(`/profile/${personId}`)
    },
    [router, rawPeople, setSelectedFamilyMember],
  )

  // ─── Zoom / pan controls ─────────────────────────────────────────────────────

  const handleZoomIn = useCallback(() => canvasRef.current?.zoomIn(), [])
  const handleZoomOut = useCallback(() => canvasRef.current?.zoomOut(), [])
  const handleResetView = useCallback(() => canvasRef.current?.resetView(), [])

  // ─── Render ──────────────────────────────────────────────────────────────────

  const hasData = rawPeople.length > 0

  return (
    <Box
      sx={{
        bgcolor: isMobile ? 'rgba(208, 227, 230, 0.3)' : 'rgba(208, 227, 230, 0.2)',
        p: isFullscreen ? 1 : 0,
        m: 0,
        position: isFullscreen ? 'fixed' : 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: isMobile ? 'calc(100dvh - 112px)' : 'auto',
        ...(isFullscreen && {
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1300,
          overflow: 'hidden',
        }),
      }}
    >
      {/* Search & Toolbar Row — static, above the canvas, never floats over it */}
      {!isFullscreen && (
        <Box 
          sx={{ 
            width: '100%',
            maxWidth: isMobile ? 'none' : 1200, 
            mx: 'auto', 
            mb: { xs: 0, md: 2 },
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            position: 'sticky',
            top: { xs: 56, md: 64 },
            zIndex: 25,
            pt: 0.5,
            pb: 1,
            background: isMobile ? 'rgba(246,243,238,1)' : 'linear-gradient(to bottom, rgba(246,243,238,0.95), rgba(246,243,238,0.65), rgba(246,243,238,0))',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              bgcolor: 'background.paper',
              px: { xs: 1, md: 1.5 },
              py: 0.5,
              borderRadius: isMobile ? 0 : 8,
              boxShadow: isMobile ? 'none' : '0 1px 3px rgba(0,0,0,0.1)',
              border: 'none',
              borderBottom: isMobile ? '1px solid rgba(22, 51, 74, 0.08)' : undefined,
              minHeight: 56, // Match height of search bar but allow growth
              flex: 1,
              width: '100%',
              zIndex: 100, // Ensure search results are above canvas
            }}
          >
            {isMobile ? (
              <IconButton 
                onClick={() => setIsMobileSearchOpen(true)}
                sx={{ color: 'primary.main', mr: 0.5 }}
              >
                <Search />
              </IconButton>
            ) : (
              <Box sx={{ flex: 1, mr: 1, minWidth: 0 }}>
                <FamilyMemberSearch
                  members={searchableMembers}
                  selectedId={selectedSearchMemberId}
                  onSelect={(member) => {
                    setSelectedSearchMemberId(member?.id ?? null)
                    if (member) {
                      // If already in the current tree view, just center on them
                      const isCurrentlyVisible = rawPeople.some(p => p.id === member.id)
                      
                      if (isCurrentlyVisible) {
                        canvasRef.current?.centerOnNode(member.id, { zoom: 1 })
                      } else {
                        // Otherwise, fetch a new tree focused on them
                        onSetRoot?.(member.id)
                        // The tree will re-render and fit view automatically when data arrives
                      }
                    }
                  }}
                  onSearch={handleRemoteSearch}
                  loading={isSearching}
                  placeholder="Search family..."
                  title="Search"
                  showSelectedChip={false}
                  allowClear={true}
                  sx={{
                    p: 0,
                    bgcolor: 'transparent',
                    boxShadow: 'none',
                    backdropFilter: 'none',
                    '& .MuiBox-root': { mt: 0 },
                    '& input': { py: 1, bgcolor: 'transparent' },
                    '& > .MuiBox-root:first-of-type': { display: 'none' } // Hide header
                  }}
                />
              </Box>
            )}

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }} />
            
            <IconButton
              size="small"
              onClick={handleFindMe}
              title="Find Me (Root)"
              sx={{ 
                color: 'primary.main',
                '&:hover': { bgcolor: 'rgba(22, 51, 74, 0.08)' }
              }}
            >
              <AccountCircle sx={{ fontSize: 18 }} />
            </IconButton>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }} />
            <IconButton size="small" sx={{ color: 'primary.main' }} onClick={handleZoomIn}>
              <ZoomIn />
            </IconButton>
            <IconButton size="small" sx={{ color: 'primary.main' }} onClick={handleZoomOut}>
              <ZoomOut />
            </IconButton>
            
            {!isMobile && (
              <>
                {onExpandDepth && (
                  <>
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }} />
                    <Button
                      startIcon={<UnfoldMore />}
                      size="small"
                      onClick={onExpandDepth}
                      title={`Current depth: ${loadedDepths ? `↑${loadedDepths.up} ↓${loadedDepths.down}` : '2/2'}`}
                      sx={{ color: 'primary.main', textTransform: 'none' }}
                    >
                      Expand
                    </Button>
                  </>
                )}
                {onImportGedcom && (
                  <>
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }} />
                    <Button
                      startIcon={<Upload sx={{ fontSize: 18 }} />}
                      size="small"
                      onClick={onImportGedcom}
                      title="Import GEDCOM file"
                      sx={{ color: 'primary.main', textTransform: 'none' }}
                    >
                      Import
                    </Button>
                  </>
                )}
                {onExportGedcom && (
                  <>
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }} />
                    <Button
                      startIcon={<Download sx={{ fontSize: 18 }} />}
                      size="small"
                      onClick={onExportGedcom}
                      title="Export GEDCOM file"
                      sx={{ color: 'primary.main', textTransform: 'none' }}
                    >
                      Export
                    </Button>
                  </>
                )}
              </>
            )}

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }} />
            <IconButton
              size="small"
              onClick={handleResetView}
              sx={{ color: 'primary.main' }}
            >
              <RestartAlt />
            </IconButton>
            {onToggleFullscreen && (
              <>
                <Divider
                  orientation="vertical"
                  flexItem
                  sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }}
                />
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
      )}

      {/* Fullscreen Toolbar */}
      {isFullscreen && (
        <Box
          sx={{
            position: 'fixed',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1350,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            bgcolor: 'background.paper',
            px: 1,
            py: 0.5,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: '1px solid',
            borderColor: 'rgba(208, 227, 230, 0.5)',
          }}
        >
          <IconButton
            size="small"
            onClick={handleFindMe}
            title="Find Me (Root)"
            sx={{ color: 'primary.main' }}
          >
            <AccountCircle sx={{ fontSize: 18 }} />
          </IconButton>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <IconButton size="small" sx={{ color: 'primary.main' }} onClick={handleZoomIn}>
            <ZoomIn />
          </IconButton>
          <IconButton size="small" sx={{ color: 'primary.main' }} onClick={handleZoomOut}>
            <ZoomOut />
          </IconButton>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Button
            startIcon={<RestartAlt />}
            size="small"
            onClick={handleResetView}
            sx={{ color: 'primary.main', textTransform: 'none' }}
          >
            Reset
          </Button>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <IconButton
            size="small"
            onClick={onToggleFullscreen}
            sx={{ color: 'primary.main' }}
          >
            <FullscreenExit />
          </IconButton>
        </Box>
      )}

      {/* Family Tree Canvas — React Flow requires explicit pixel height on its parent */}
      <Box
        sx={{
          position: 'relative',
          height: isFullscreen ? 'calc(100vh - 140px)' : { xs: 'calc(100dvh - 168px)', md: 700 },
          width: '100%',
          bgcolor: 'transparent',
          borderRadius: 0,
          overflow: 'hidden',
          flexGrow: 1,
        }}
      >
        {hasData && effectiveRootId ? (
          <ReactFlowTreeCanvas
            people={rawPeople}
            rootPersonId={effectiveRootId}
            selectedPersonId={selectedPersonId}
            userPersonId={userPersonId}
            canvasRef={canvasRef}
            onPersonClick={handlePersonClick}
            onAddPerson={handleAddPerson}
            onViewMemories={handleViewMemories}
            onViewFullProfile={onViewFullProfile}
            onSetRoot={onSetRoot}
            onLoadMore={_onLoadMore}
            onEditRelationships={handleAddRelationship}
            isPanMode={true}
            fitViewTrigger={fitViewTrigger}
          />
        ) : (
          /* Empty state */
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: 400,
              gap: 3,
            }}
          >
            <Typography
              variant="h4"
              sx={{ fontFamily: 'var(--font-newsreader), serif', color: 'primary.main' }}
            >
              Begin your family legacy
            </Typography>
            <Typography variant="body1" sx={{ color: 'secondary.main', textAlign: 'center', maxWidth: 400 }}>
              Add your first family member to start building your tree.
            </Typography>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                bgcolor: 'rgba(208, 227, 230, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'secondary.main',
                cursor: 'pointer',
                transition: 'all 0.3s',
                '&:hover': { bgcolor: 'primary.main', color: 'white' },
              }}
              onClick={handleAddPerson}
            >
              <Add fontSize="large" />
            </Box>
          </Box>
        )}
      </Box>

      {/* Add Relative Button (below canvas) */}
      {hasData && !isMobile && (
        <Box
          sx={{ mt: 4, cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
          onClick={handleAddPerson}
        >
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
                '&:hover': { bgcolor: 'primary.main', color: 'white' },
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
      )}

      {/* Legend + Insights Sidebar — fixed so it overlays above canvas and all children */}
      <Box
        sx={{
          position: 'fixed',
          right: 48,
          top: isFullscreen ? 16 : 160,
          display: { xs: 'none', xl: 'flex' },
          flexDirection: 'column',
          gap: 2,
          zIndex: 1250,
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
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => setLegendCollapsed((prev: boolean) => !prev)}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
              Legend
            </Typography>
            <IconButton size="small" sx={{ p: 0, ml: 1, color: 'secondary.main' }}>
              {legendCollapsed ? (
                <ExpandMore sx={{ fontSize: 16 }} />
              ) : (
                <ExpandLess sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Box>
          {!legendCollapsed && (
            <Box sx={{ mt: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75 }}>
                <Box sx={{ width: 26, height: CONNECTOR_THICKNESS, bgcolor: CONNECTOR_BIOLOGICAL_COLOR }} />
                <Typography variant="caption" sx={{ color: 'secondary.main' }}>
                  Biological parent-child
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75 }}>
                <Box
                  sx={{
                    width: 26,
                    borderTop: `${CONNECTOR_THICKNESS}px dashed ${CONNECTOR_NON_BIO_COLOR}`,
                  }}
                />
                <Typography variant="caption" sx={{ color: 'secondary.main' }}>
                  Adopted/step/in-law parent-child
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box sx={{ width: 26, height: CONNECTOR_THICKNESS, bgcolor: CONNECTOR_SPOUSE_COLOR }} />
                <Typography variant="caption" sx={{ color: 'secondary.main' }}>
                  Spouse
                </Typography>
              </Box>
            </Box>
          )}
        </Card>

        {/* Insights Sidebar */}
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
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              mb: insightCollapsed ? 0 : 3,
            }}
            onClick={() => setInsightCollapsed((prev: boolean) => !prev)}
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
              <Card
                sx={{
                  bgcolor: 'rgba(208, 227, 230, 0.3)',
                  p: 3,
                  borderRadius: 4,
                  mb: 3,
                  maxHeight: 300,
                  overflowY: 'auto'
                }}
              >
                <Typography variant="body2" sx={{ color: 'secondary.main', fontStyle: familyBio ? 'normal' : 'italic', lineHeight: 1.6 }}>
                  {familyBio || '"Each family member added here contributes to a larger narrative of resilience and connection waiting to be told."'}
                </Typography>
              </Card>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1, mb: 2 }}>
                <Box
                  sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'tertiary.main' }}
                />
                <Typography variant="body2" sx={{ color: 'secondary.main' }}>
                  {rawPeople.length} family members charted
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

              <Button
                fullWidth
                variant="contained"
                disabled={isGeneratingBio || rawPeople.length === 0}
                onClick={onGenerateBio}
                endIcon={isGeneratingBio ? <CircularProgress size={20} color="inherit" /> : <AutoFixHigh />}
                sx={{ mt: 4, py: 1.5, borderRadius: 3, textTransform: 'none', fontWeight: 600 }}
              >
                {isGeneratingBio ? 'Generating...' : familyBio ? 'Regenerate Family Bio' : 'Generate Family Bio'}
              </Button>
            </>
          )}
        </Card>
      </Box>

      {/* Person Detail Modal */}
      <PersonDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        person={personDetail as any}
        stories={personStories as any}
        voiceProfiles={personVoiceProfiles as any}
        relationships={personRelationships as any}
        isLoading={isLoadingDetail}
        error={detailError}
        onEdit={handleEditPerson}
        onDelete={handleDeletePerson}
        onAddStory={handleAddStory}
        onAddVoiceProfile={handleAddVoiceProfile}
        onAddRelationship={handleAddRelationship}
        onStoryClick={handleStoryClick}
        onViewFullProfile={handleViewFullProfile}
      />

      {/* Add/Edit Person Modal — edit path only */}
      {addEditMode === 'edit' && (
        <AddEditPersonModal
          open={addEditModalOpen}
          onClose={() => setAddEditModalOpen(false)}
          mode={addEditMode}
          person={
            addEditMode === 'edit' && personDetail
              ? {
                  firstName: personDetail.firstName as string,
                  lastName: personDetail.lastName as string,
                  displayName: personDetail.displayName as string,
                  birthDate: (personDetail.birthDate as string | undefined)?.split('T')[0],
                  deathDate: (personDetail.deathDate as string | undefined)?.split('T')[0],
                  bio: personDetail.bio as string,
                  personType: personDetail.personType as PersonType,
                }
              : undefined
          }
          onSubmit={handleSubmitPerson}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Mobile Search Modal */}
      <Dialog
        fullScreen={isMobile}
        open={isMobileSearchOpen}
        onClose={() => setIsMobileSearchOpen(false)}
        PaperProps={{
          sx: { bgcolor: 'rgba(246, 243, 238, 0.98)', backdropFilter: 'blur(10px)' }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
            <IconButton onClick={() => setIsMobileSearchOpen(false)}>
              <Close />
            </IconButton>
          </Box>
          <FamilyMemberSearch
            members={searchableMembers}
            selectedId={selectedSearchMemberId}
            onSelect={(member) => {
              setSelectedSearchMemberId(member?.id ?? null)
              if (member) {
                const isCurrentlyVisible = rawPeople.some(p => p.id === member.id)
                if (isCurrentlyVisible) {
                  canvasRef.current?.centerOnNode(member.id, { zoom: 1 })
                } else {
                  onSetRoot?.(member.id)
                }
                setIsMobileSearchOpen(false)
              }
            }}
            onSearch={handleRemoteSearch}
            loading={isSearching}
            placeholder="Search family member..."
            title="Family Search"
            showSelectedChip={false}
            allowClear={true}
          />
        </Box>
      </Dialog>
    </Box>
  )
}
