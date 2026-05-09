import { useState, useEffect, useCallback } from 'react'
import { Box, CircularProgress, Typography, Button } from '@mui/material'
import { TimelinePageComponent } from '@/components/pages/TimelinePage'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'

interface TimelineEvent {
  id: string
  type: 'birth' | 'death' | 'marriage' | 'divorce' | 'story' | 'document' | 'custom'
  date: string | null
  datePrecision: string
  title: string
  description?: string
  people: Array<{
    id: string
    firstName: string
    lastName?: string
    displayName?: string
    avatarAssetId?: string
    role?: string
  }>
  metadata?: {
    imageAssetId?: string
    documentType?: string
    [key: string]: unknown
  }
  sourceId: string
  sourceType: string
}

interface PersonOption {
  id: string
  firstName: string
  lastName?: string
  displayName?: string
}

export function LifeJourneyLens() {
  const { selectedFamilyMember } = useSelectedFamilyMember()
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [people, setPeople] = useState<PersonOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const fetchEvents = useCallback(async (pageNum: number, append: boolean = false) => {
    try {
      const params = new URLSearchParams()
      params.set('page', pageNum.toString())
      params.set('limit', '50')
      if (selectedFamilyMember?.id) {
        params.set('personId', selectedFamilyMember.id)
      }

      const response = await fetch(`/api/timeline?${params.toString()}`, { credentials: 'include' })
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch timeline events')
      }

      if (append) {
        setEvents(prev => [...prev, ...data.data])
      } else {
        setEvents(data.data)
      }
      setHasMore(data.pagination.totalPages > pageNum)
    } catch (err) {
      console.error('Error fetching timeline:', err)
      setHasError(true)
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load timeline')
    }
  }, [selectedFamilyMember?.id])

  const fetchPeople = useCallback(async () => {
    try {
      const res = await fetch('/api/people', { credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setPeople(data.data || [])
      }
    } catch {
      setPeople([])
    }
  }, [])

  useEffect(() => {
    setIsLoading(true)
    setHasError(false)
    setPage(1)
    Promise.all([fetchEvents(1, false), fetchPeople()]).finally(() => setIsLoading(false))
  }, [fetchEvents, fetchPeople])

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore) return
    setIsLoadingMore(true)
    const nextPage = page + 1
    await fetchEvents(nextPage, true)
    setPage(nextPage)
    setIsLoadingMore(false)
  }, [fetchEvents, isLoadingMore, page])

  const handleEventCreated = useCallback(() => {
    setPage(1)
    fetchEvents(1, false)
  }, [fetchEvents])

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (hasError) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '40vh', gap: 2 }}>
        <Typography color="error">{errorMessage}</Typography>
        <Button
          variant="contained"
          onClick={() => {
            setHasError(false)
            setIsLoading(true)
            fetchEvents(1, false).finally(() => setIsLoading(false))
          }}
        >
          Retry
        </Button>
      </Box>
    )
  }

  return (
    <TimelinePageComponent
      events={events}
      isLoading={isLoadingMore}
      hasMore={hasMore}
      onLoadMore={handleLoadMore}
      onEventCreated={handleEventCreated}
      people={people}
    />
  )
}
