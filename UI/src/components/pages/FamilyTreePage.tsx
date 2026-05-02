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
} from '@mui/material'
import {
  ZoomIn,
  ZoomOut,
  RestartAlt,
  Add,
  AutoFixHigh,
  AutoStories,
  PersonAdd,
  NearMe,
  PanTool,
  Fullscreen,
  FullscreenExit,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material'
import { PersonDetailModal } from '@/components/modals/PersonDetailModal'
import { AddEditPersonModal, PersonFormData } from '@/components/modals/AddEditPersonModal'
import { FamilyMemberSearch, SearchableFamilyMember } from '@/components/search'
import { fetchWithCSRFAndJSON, fetchWithCSRF } from '@/lib/api-client'
import { ReactFlowTreeCanvas, ReactFlowTreeCanvasHandle } from '@/components/pages/family-tree/xyflow/ReactFlowTreeCanvas'
import type { ApiPersonWithEdges, TreeLayoutPerson } from '@/components/pages/family-tree/xyflow/types'
import type { PersonType } from '@/contracts'

// ─── Legacy shape used by the page and search overlay ────────────────────────

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

interface FamilyTreeData {
  grandparents: TreePerson[]
  parents: TreePerson[]
  children: TreePerson[]
  childrenConnectorParentId?: string
  relationshipEdges: {
    id: string
    sourceId: string
    targetId: string
    type: 'SPOUSE' | 'PARENT_CHILD'
    relationshipKind: 'biological' | 'nonBiological'
  }[]
}

const CONNECTOR_BIOLOGICAL_COLOR = 'rgba(22, 51, 74, 0.52)'
const CONNECTOR_NON_BIO_COLOR = 'rgba(22, 51, 74, 0.35)'
const CONNECTOR_SPOUSE_COLOR = 'rgba(22, 51, 74, 0.34)'
const CONNECTOR_THICKNESS = 3

// ─── Props ────────────────────────────────────────────────────────────────────

interface FamilyTreePageProps {
  /** Legacy mapped data — used for search overlay only */
  people?: FamilyTreeData
  /** Raw API data — drives the @xyflow/react canvas */
  rawPeople?: ApiPersonWithEdges[]
  rootPersonId?: string
  onPersonClick?: (person: { id: string | number; name: string; avatar: string }) => void
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

// ─── Component ────────────────────────────────────────────────────────────────

export function FamilyTreePage({
  people,
  rawPeople = [],
  rootPersonId,
  onPersonClick,
  onAddPerson,
  onEditRelationships,
  isFullscreen = false,
  onToggleFullscreen,
  initialSearchExpanded = false,
}: FamilyTreePageProps): React.JSX.Element {
  const router = useRouter()
  useTheme()
  const familyData =
    people &&
    (people.grandparents.length > 0 || people.parents.length > 0 || people.children.length > 0)
      ? people
      : defaultFamilyData

  // Derive rootPersonId from the mapped data (the 'Self' card) if not supplied
  const effectiveRootId: string = useMemo(() => {
    if (rootPersonId) return rootPersonId
    const selfEntry =
      familyData.parents.find((p) => p.selected) ??
      familyData.parents[0] ??
      familyData.grandparents[0] ??
      familyData.children[0]
    return selfEntry ? String(selfEntry.id) : ''
  }, [rootPersonId, familyData])

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

  // Data states
  const [personDetail, setPersonDetail] = useState<Record<string, unknown> | null>(null)
  const [personStories, setPersonStories] = useState<unknown[]>([])
  const [personVoiceProfiles, setPersonVoiceProfiles] = useState<unknown[]>([])
  const [personRelationships, setPersonRelationships] = useState<unknown[]>([])
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Search overlay members
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

  // ─── Handlers ───────────────────────────────────────────────────────────────

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
          fetch(`/api/stories?personId=${person.id}&limit=20`, { credentials: 'include' }),
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

  const handleViewArchive = useCallback(
    (person: TreeLayoutPerson) => {
      router.push(`/profile/${person.id}`)
    },
    [router],
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

  const handleAddStory = useCallback((_personId: string) => {
    // Navigate to story creation with person pre-selected
  }, [])

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
    const fallbackPersonId =
      selectedPersonId ??
      (familyData.parents[0] ? String(familyData.parents[0].id) : null) ??
      (familyData.children[0] ? String(familyData.children[0].id) : null) ??
      (familyData.grandparents[0] ? String(familyData.grandparents[0].id) : null)

    if (fallbackPersonId) {
      handleAddRelationship(fallbackPersonId)
    } else {
      handleAddPerson()
    }
  }, [selectedPersonId, familyData, handleAddRelationship, handleAddPerson])

  const handleStoryClick = useCallback((_storyId: string) => {
    // Navigate to story detail page
  }, [])

  const handleViewFullProfile = useCallback(
    (personId: string) => {
      router.push(`/profile/${personId}`)
    },
    [router],
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
      {/* Sticky toolbar */}
      <Box
        sx={{
          position: 'sticky',
          top: isFullscreen ? 8 : { xs: 72, md: 84 },
          zIndex: 25,
          pt: 0.5,
          pb: 1.5,
          mb: 1,
          background:
            'linear-gradient(to bottom, rgba(246,243,238,0.95), rgba(246,243,238,0.65), rgba(246,243,238,0))',
          backdropFilter: 'blur(6px)',
        }}
      >
        {/* Search Panel */}
        <Box sx={{ maxWidth: 1200, mx: 'auto', mb: 2 }}>
          <FamilyMemberSearch
            members={searchableMembers}
            selectedId={selectedSearchMemberId}
            onSelect={(member) => setSelectedSearchMemberId(member?.id ?? null)}
            defaultExpanded={initialSearchExpanded}
            placeholder="Search by name or relationship"
            title="Family Member Search"
            showSelectedChip={true}
            allowClear={true}
          />
        </Box>

        {/* Control Bar */}
        <Box sx={{ maxWidth: 1200, mx: 'auto', display: 'flex', justifyContent: 'center' }}>
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
              sx={{ color: 'primary.main' }}
              title="Pointer tool"
            >
              <NearMe sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              sx={{ color: 'primary.main' }}
              title="Pan (drag canvas)"
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
      </Box>

      {/* Family Tree Canvas */}
      <Box
        sx={{
          position: 'relative',
          minHeight: isFullscreen ? 'calc(100vh - 140px)' : 700,
          width: '100%',
          bgcolor: 'rgba(208, 227, 230, 0.3)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {hasData && effectiveRootId ? (
          <ReactFlowTreeCanvas
            people={rawPeople}
            rootPersonId={effectiveRootId}
            canvasRef={canvasRef}
            onPersonClick={handlePersonClick}
            onAddPerson={handleAddPerson}
            onViewArchive={handleViewArchive}
            onSetRoot={undefined}
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
      {hasData && (
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
                }}
              >
                <Typography variant="body2" sx={{ color: 'secondary.main', fontStyle: 'italic' }}>
                  &quot;Most family stories reference &apos;The Summer of &apos;84&apos; at the lake
                  house.&quot;
                </Typography>
              </Card>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1, mb: 2 }}>
                <Box
                  sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'tertiary.main' }}
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

              <Button
                fullWidth
                variant="contained"
                endIcon={<AutoFixHigh />}
                sx={{ mt: 4, py: 1.5, borderRadius: 3 }}
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
        voiceProfiles={personVoiceProfiles}
        relationships={personRelationships}
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
    </Box>
  )
}
