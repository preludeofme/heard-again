import { useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/router'
import { fetchWithCSRFAndJSON, fetchWithCSRF } from '@/lib/api-client'
import { TreePerson, FamilyTreeData, PersonFormData } from './types'

export function useFamilyTree(
  familyData: FamilyTreeData,
  onPersonClick?: (person: TreePerson) => void,
  onAddPerson?: () => void,
  onEditRelationships?: (personId: string) => void,
  onPeopleChanged?: () => void
) {
  const router = useRouter()
  
  // Modal states
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [addEditModalOpen, setAddEditModalOpen] = useState(false)
  const [addEditMode, setAddEditMode] = useState<'create' | 'edit'>('create')
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // View states
  const [zoomLevel, setZoomLevel] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [toolMode, setToolMode] = useState<'pointer' | 'hand'>('pointer')
  
  // Sidebar states
  const [legendCollapsed, setLegendCollapsed] = useState(false)
  const [insightCollapsed, setInsightCollapsed] = useState(false)
  
  // Detail states
  const [personDetail, setPersonDetail] = useState<any>(null)
  const [personStories, setPersonStories] = useState<any[]>([])
  const [personVoiceProfiles, setPersonVoiceProfiles] = useState<any[]>([])
  const [personRelationships, setPersonRelationships] = useState<any[]>([])
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  
  // Voice states
  const [voiceTrainingPersonId, setVoiceTrainingPersonId] = useState<string | null>(null)
  
  // Search states
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false)
  const [overlayQuery, setOverlayQuery] = useState('')

  // Canvas drag state
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const panStart = useRef({ x: 0, y: 0 })
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const touchPanStart = useRef({ x: 0, y: 0 })
  const touchMoved = useRef(false)

  // Handlers
  const handlePersonClick = async (person: TreePerson) => {
    setSelectedPersonId(String(person.id))
    setDetailModalOpen(true)
    onPersonClick?.(person)

    setIsLoadingDetail(true)
    setDetailError(null)
    try {
      const [personRes, storiesRes, relationshipsRes] = await Promise.all([
        fetch(`/api/people/${person.id}`, { credentials: 'include' }),
        fetch(`/api/stories?personId=${person.id}&limit=20`, { credentials: 'include' }),
        fetch(`/api/people/${person.id}/relationships`, { credentials: 'include' }),
      ])

      const personData = await personRes.json()
      const storiesData = await storiesRes.json()
      const relationshipsData = await relationshipsRes.json()

      if (personData.success) {
        setPersonDetail(personData.data)
        setPersonStories(storiesData.data?.stories || [])
        setPersonVoiceProfiles(personData.data.voiceProfiles || [])
        setPersonRelationships(relationshipsData.data || [])
      } else {
        setDetailError(personData.error || 'Failed to load person details')
      }
    } catch (err) {
      console.error('Error fetching person details:', err)
      setDetailError('Failed to load person details')
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const handleAddPerson = () => {
    setSelectedPersonId(null)
    setAddEditMode('create')
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
      onPeopleChanged?.()
    } catch (err) {
      console.error('Error saving person:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePerson = async (personId: string) => {
    try {
      const res = await fetchWithCSRF(`/api/people/${personId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete person')
      setDetailModalOpen(false)
      onPeopleChanged?.()
    } catch (err) {
      console.error('Error deleting person:', err)
    }
  }

  const handleAddStory = (personId: string) => {
    router.push(`/stories?subjectId=${personId}`)
  }

  const handleAddVoiceProfile = (personId: string) => {
    setVoiceTrainingPersonId(personId)
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

  const handleCanvasTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
    touchPanStart.current = { ...panOffset }
    touchMoved.current = false
  }, [panOffset])

  const handleCanvasTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1 || !touchStart.current) return
    e.preventDefault()
    const touch = e.touches[0]
    const dx = touch.clientX - touchStart.current.x
    const dy = touch.clientY - touchStart.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      touchMoved.current = true
    }
    setPanOffset({
      x: touchPanStart.current.x + dx,
      y: touchPanStart.current.y + dy,
    })
  }, [])

  const handleCanvasTouchEnd = useCallback(() => {
    touchStart.current = null
  }, [])

  return {
    // View state
    zoomLevel,
    setZoomLevel,
    panOffset,
    setPanOffset,
    toolMode,
    setToolMode,
    isDragging: isDragging.current,
    
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
    insightCollapsed,
    setInsightCollapsed,
    
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
    handleCanvasTouchEnd
  }
}
