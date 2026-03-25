import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { TimelinePageComponent } from '@/components/pages/TimelinePage'
import { useState, useEffect, useCallback } from 'react'
import { Box, CircularProgress, Typography, Button } from '@mui/material'
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
  metadata?: Record<string, any>
  sourceId: string
  sourceType: string
}

export default function TimelinePage() {
  const { selectedFamilyMember } = useSelectedFamilyMember()
  const [events, setEvents] = useState<TimelineEvent[]>([])
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

      const response = await fetch(`/api/timeline?${params.toString()}`)
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

  useEffect(() => {
    setIsLoading(true)
    setHasError(false)
    setPage(1)
    fetchEvents(1, false).finally(() => setIsLoading(false))
  }, [fetchEvents])

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore) return
    setIsLoadingMore(true)
    const nextPage = page + 1
    await fetchEvents(nextPage, true)
    setPage(nextPage)
    setIsLoadingMore(false)
  }, [fetchEvents, isLoadingMore, page])

  return (
    <>
      <Head>
        <title>Family Timeline - Heard Again</title>
        <meta name="description" content="Family timeline with births, deaths, marriages, stories, and documents" />
      </Head>
      <Layout>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <CircularProgress />
          </Box>
        ) : hasError ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 2 }}>
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
        ) : (
          <TimelinePageComponent
            events={events}
            isLoading={isLoadingMore}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
          />
        )}
      </Layout>
    </>
  )
}
