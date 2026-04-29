import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Avatar,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Skeleton,
  Fade,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab'
import {
  Cake as BirthIcon,
  Church as DeathIcon,
  Favorite as MarriageIcon,
  MenuBook as StoryIcon,
  Description as DocumentIcon,
  Star as CustomIcon,
  FilterList as FilterIcon,
  Timeline as TimelineIcon,
  Add as AddIcon,
  Close as CloseIcon,
  ViewHeadline as VerticalIcon,
  ViewWeek as HorizontalIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import Link from 'next/link'

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

interface TimelinePageProps {
  events: TimelineEvent[]
  isLoading: boolean
  hasMore: boolean
  onLoadMore: () => void
  onEventCreated?: () => void
  people?: Array<{ id: string; firstName: string; lastName?: string; displayName?: string }>
}

const eventTypeConfig = {
  birth: { icon: BirthIcon, color: '#4caf50', label: 'Birth' },
  death: { icon: DeathIcon, color: '#757575', label: 'Death' },
  marriage: { icon: MarriageIcon, color: '#e91e63', label: 'Marriage' },
  divorce: { icon: MarriageIcon, color: '#ff9800', label: 'Divorce' },
  story: { icon: StoryIcon, color: '#16334a', label: 'Story' },
  document: { icon: DocumentIcon, color: '#adcae6', label: 'Document' },
  custom: { icon: CustomIcon, color: '#9c27b0', label: 'Event' },
}

function formatEventDate(date: string | null, precision: string): string {
  if (!date) return 'Unknown date'

  const d = new Date(date)

  switch (precision) {
    case 'EXACT':
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    case 'YEAR_MONTH':
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    case 'YEAR':
      return d.getFullYear().toString()
    case 'DECADE':
      return `${Math.floor(d.getFullYear() / 10) * 10}s`
    case 'APPROXIMATE':
      return `c. ${d.toLocaleDateString('en-US', { year: 'numeric' })}`
    default:
      return d.toLocaleDateString()
  }
}

function getPersonDisplayName(person: { firstName: string; lastName?: string; displayName?: string }): string {
  return person.displayName || `${person.firstName} ${person.lastName || ''}`.trim()
}

export function TimelinePageComponent({ events, isLoading, hasMore, onLoadMore, onEventCreated, people = [] }: TimelinePageProps) {
  const { selectedFamilyMember, setSelectedFamilyMember } = useSelectedFamilyMember()
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['all'])
  const [viewMode, setViewMode] = useState<'vertical' | 'horizontal'>('vertical')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  
  // Dragging logic for horizontal view
  const timelineRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragScrollLeft, setDragScrollLeft] = useState(0)
  const [hasDragged, setHasDragged] = useState(false)

  // Event Detail Dialog State
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)

  // Add Event Dialog State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newEvent, setNewEvent] = useState({
    personId: '',
    eventType: 'CUSTOM',
    eventDate: '',
    title: '',
    description: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const filteredEvents = useMemo(() => {
    let result = events
    if (!selectedTypes.includes('all')) {
      result = result.filter(e => selectedTypes.includes(e.type))
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime()
      result = result.filter(e => e.date && new Date(e.date).getTime() >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime()
      result = result.filter(e => e.date && new Date(e.date).getTime() <= to)
    }
    return result
  }, [events, selectedTypes, dateFrom, dateTo])

  const handleTypeChange = (event: React.MouseEvent<HTMLElement>, newTypes: string[]) => {
    if (newTypes.length === 0) {
      setSelectedTypes(['all'])
    } else if (newTypes.includes('all') && !selectedTypes.includes('all')) {
      setSelectedTypes(['all'])
    } else if (newTypes.length > 1 && newTypes.includes('all')) {
      setSelectedTypes(newTypes.filter(t => t !== 'all'))
    } else {
      setSelectedTypes(newTypes)
    }
  }

  const handleOpenAddDialog = () => {
    setNewEvent({
      personId: selectedFamilyMember?.id || '',
      eventType: 'CUSTOM',
      eventDate: '',
      title: '',
      description: '',
    })
    setSubmitError('')
    setIsAddDialogOpen(true)
  }

  const handleCloseAddDialog = () => {
    setIsAddDialogOpen(false)
  }

  const handleOpenDetail = (event: TimelineEvent) => {
    if (!hasDragged) {
      setSelectedEvent(event)
      setIsDetailDialogOpen(true)
    }
  }

  const handleCloseDetail = () => {
    setIsDetailDialogOpen(false)
  }

  const handleSubmitEvent = async () => {
    if (!newEvent.personId || !newEvent.eventDate || !newEvent.title) {
      setSubmitError('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const response = await fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          personId: newEvent.personId,
          eventType: newEvent.eventType,
          eventDate: new Date(newEvent.eventDate).toISOString(),
          title: newEvent.title,
          description: newEvent.description,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to create event')
      }

      setIsAddDialogOpen(false)
      onEventCreated?.()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Drag Handlers
  const onDragStart = (e: React.MouseEvent) => {
    if (!timelineRef.current) return
    setIsDragging(true)
    setHasDragged(false)
    setDragStartX(e.pageX - timelineRef.current.offsetLeft)
    setDragScrollLeft(timelineRef.current.scrollLeft)
  }

  const onDragMove = (e: React.MouseEvent) => {
    if (!isDragging || !timelineRef.current) return
    e.preventDefault()
    const x = e.pageX - timelineRef.current.offsetLeft
    const delta = (x - dragStartX) * 1.5
    if (Math.abs(delta) > 5) setHasDragged(true)
    timelineRef.current.scrollLeft = dragScrollLeft - delta
  }

  const onDragEnd = () => setIsDragging(false)

  const onTouchStart = (e: React.TouchEvent) => {
    if (!timelineRef.current) return
    setIsDragging(true)
    setHasDragged(false)
    setDragStartX(e.touches[0].pageX)
    setDragScrollLeft(timelineRef.current.scrollLeft)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !timelineRef.current) return
    const x = e.touches[0].pageX
    const delta = (x - dragStartX) * 1.5
    if (Math.abs(delta) > 5) setHasDragged(true)
    timelineRef.current.scrollLeft = dragScrollLeft - delta
  }

  if (isLoading && events.length === 0) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: ProfileColors.surface, px: { xs: 3, md: 8 }, py: 6 }}>
        <Skeleton variant="text" width={300} height={60} sx={{ mb: 4 }} />
        <Timeline>
          {[1, 2, 3].map((i) => (
            <TimelineItem key={i}>
              <TimelineSeparator>
                <Skeleton variant="circular" width={40} height={40} />
                <TimelineConnector />
              </TimelineSeparator>
              <TimelineContent>
                <Skeleton variant="rectangular" height={120} sx={{ mb: 2 }} />
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: ProfileColors.surface, px: { xs: 2, md: 8 }, py: 6 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2 }}>
        <Box>
          <Typography variant="h3" className="serif-font" sx={{ color: ProfileColors.primary, mb: 1, fontSize: { xs: '2rem', md: '3rem' } }}>
            Family Timeline
          </Typography>
          <Typography variant="body1" sx={{ color: ProfileColors.onSurfaceVariant }}>
            {selectedFamilyMember
              ? `Events for ${getPersonDisplayName(selectedFamilyMember)}`
              : 'Family events across generations'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, next) => next && setViewMode(next)}
            size="small"
            aria-label="view mode"
          >
            <ToggleButton value="vertical" aria-label="vertical view">
              <Tooltip title="Vertical View">
                <VerticalIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="horizontal" aria-label="horizontal view">
              <Tooltip title="Horizontal View">
                <HorizontalIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddDialog}
            sx={{
              bgcolor: ProfileColors.primary,
              color: 'white',
              '&:hover': { bgcolor: ProfileColors.primaryContainer },
              borderRadius: 2,
              px: 3,
            }}
          >
            Add Event
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 4, borderRadius: 3, bgcolor: '#ffffff', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: { xs: 'stretch', md: 'center' } }}>
              <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 240 } }}>
                <InputLabel>Family Member</InputLabel>
                <Select
                  value={selectedFamilyMember?.id || 'all'}
                  label="Family Member"
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === 'all') {
                      setSelectedFamilyMember(null)
                    } else {
                      const person = people.find(p => p.id === val)
                      if (person) setSelectedFamilyMember(person)
                    }
                  }}
                >
                  <MenuItem value="all">All Family Members</MenuItem>
                  {people.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {getPersonDisplayName(p)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <ToggleButtonGroup
                value={selectedTypes}
                onChange={handleTypeChange}
                aria-label="event types"
                size="small"
                sx={{ flexWrap: 'wrap', '& .MuiToggleButton-root': { py: 1, px: 2 } }}
              >
                <ToggleButton value="all" aria-label="all events">
                  All
                </ToggleButton>
                <ToggleButton value="birth" aria-label="births">
                  <BirthIcon sx={{ fontSize: 18, mr: 0.5 }} />
                  Births
                </ToggleButton>
                <ToggleButton value="death" aria-label="deaths">
                  <DeathIcon sx={{ fontSize: 18, mr: 0.5 }} />
                  Deaths
                </ToggleButton>
                <ToggleButton value="marriage" aria-label="marriages">
                  <MarriageIcon sx={{ fontSize: 18, mr: 0.5 }} />
                  Marriages
                </ToggleButton>
                <ToggleButton value="story" aria-label="stories">
                  <StoryIcon sx={{ fontSize: 18, mr: 0.5 }} />
                  Stories
                </ToggleButton>
                <ToggleButton value="document" aria-label="documents">
                  <DocumentIcon sx={{ fontSize: 18, mr: 0.5 }} />
                  Documents
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                type="date"
                label="From"
                size="small"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: { xs: 1, md: 'none' }, minWidth: 140 }}
              />
              <TextField
                type="date"
                label="To"
                size="small"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: { xs: 1, md: 'none' }, minWidth: 140 }}
              />
              <Button 
                size="small" 
                onClick={() => { setDateFrom(''); setDateTo(''); setSelectedTypes(['all']); }}
                sx={{ ml: 'auto', color: ProfileColors.onSurfaceVariant }}
              >
                Clear Filters
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Timeline Content */}
      {filteredEvents.length === 0 ? (
        <Card sx={{ borderRadius: 3, textAlign: 'center', py: 8, bgcolor: '#ffffff' }}>
          <CardContent>
            <TimelineIcon sx={{ fontSize: 60, color: '#adcae6', mb: 2 }} />
            <Typography variant="h6" sx={{ color: ProfileColors.primary, mb: 1 }}>
              No events found
            </Typography>
            <Typography variant="body2" sx={{ color: ProfileColors.onSurfaceVariant }}>
              Try adjusting your filters or adding new stories and documents.
            </Typography>
          </CardContent>
        </Card>
      ) : viewMode === 'vertical' ? (
        <>
          <Timeline position="alternate">
            {filteredEvents.map((event, index) => {
              const config = eventTypeConfig[event.type] || eventTypeConfig.custom
              const Icon = config.icon

              return (
                <Fade in timeout={300} key={event.id}>
                  <TimelineItem>
                    <TimelineSeparator>
                      <TimelineDot
                        sx={{
                          bgcolor: config.color,
                          color: 'white',
                          p: 1.5,
                          boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                          cursor: 'pointer',
                          '&:hover': { transform: 'scale(1.1)' },
                          transition: 'transform 0.2s',
                        }}
                        onClick={() => handleOpenDetail(event)}
                      >
                        <Icon sx={{ fontSize: 22 }} />
                      </TimelineDot>
                      {index < filteredEvents.length - 1 && <TimelineConnector sx={{ bgcolor: ProfileColors.outlineVariant, opacity: 0.5, width: 2 }} />}
                    </TimelineSeparator>
                    <TimelineContent sx={{ py: '12px', px: 2 }}>
                      <Card
                        onClick={() => handleOpenDetail(event)}
                        sx={{
                          borderRadius: 3,
                          bgcolor: event.type === 'story' ? '#ffffff' : 'rgba(255,255,255,0.6)',
                          boxShadow: event.type === 'story' ? 2 : 'none',
                          border: event.type === 'story' ? '1px solid #e0e0e0' : '1px transparent',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 4,
                            bgcolor: '#ffffff',
                            border: '1px solid #e0e0e0',
                          },
                          textAlign: index % 2 === 0 ? 'left' : 'right',
                        }}
                      >
                        <CardContent>
                          <Typography
                            variant="caption"
                            sx={{
                              color: config.color,
                              fontWeight: 700,
                              display: 'block',
                              mb: 0.5,
                              textTransform: 'uppercase',
                              letterSpacing: 1,
                            }}
                          >
                            {formatEventDate(event.date, event.datePrecision)}
                          </Typography>

                          <Typography 
                            variant="h6" 
                            className="serif-font"
                            sx={{ 
                              color: ProfileColors.primary, 
                              mb: 1, 
                              fontWeight: 700,
                              lineHeight: 1.2
                            }}
                          >
                            {event.title}
                          </Typography>

                          {event.metadata?.imageAssetId && (
                            <Box sx={{ mb: 2, borderRadius: 2, overflow: 'hidden', height: 120 }}>
                              <Box 
                                component="img"
                                src={`/api/assets/serve/${event.metadata.imageAssetId}`}
                                alt={event.title}
                                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            </Box>
                          )}

                          {event.description && (
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                color: ProfileColors.onSurfaceVariant, 
                                mb: 2, 
                                lineHeight: 1.5,
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              {event.description}
                            </Typography>
                          )}

                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: index % 2 === 0 ? 'flex-start' : 'flex-end', mt: 1 }}>
                            {event.people.slice(0, 3).map((person) => (
                              <Avatar
                                key={person.id}
                                src={person.avatarAssetId ? `/api/assets/serve/${person.avatarAssetId}` : undefined}
                                sx={{ width: 28, height: 28, border: `2px solid #ffffff` }}
                              >
                                {person.firstName[0]}
                              </Avatar>
                            ))}
                            {event.people.length > 3 && (
                              <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: ProfileColors.surfaceContainer }}>
                                +{event.people.length - 3}
                              </Avatar>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    </TimelineContent>
                  </TimelineItem>
                </Fade>
              )
            })}
          </Timeline>
        </>
      ) : (
        /* Horizontal View */
        <Box sx={{ position: 'relative', py: 4 }}>
          <Box sx={{ 
            position: 'absolute', 
            top: '50%', 
            left: 0, 
            right: 0, 
            height: 2, 
            background: `linear-gradient(to right, transparent, ${ProfileColors.outlineVariant}, transparent)`, 
            zIndex: 0,
            transform: 'translateY(-50%)'
          }} />
          
          <Box
            ref={timelineRef}
            onMouseDown={onDragStart}
            onMouseMove={onDragMove}
            onMouseUp={onDragEnd}
            onMouseLeave={onDragEnd}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onDragEnd}
            sx={{
              display: 'flex',
              gap: 4,
              overflowX: 'auto',
              pb: 6,
              pt: 2,
              px: 4,
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
              scrollBehavior: isDragging ? 'auto' : 'smooth',
            }}
          >
            {filteredEvents.map((event) => {
              const config = eventTypeConfig[event.type] || eventTypeConfig.custom
              const Icon = config.icon

              return (
                <Box
                  key={event.id}
                  onClick={() => handleOpenDetail(event)}
                  sx={{ 
                    flexShrink: 0, 
                    width: 320, 
                    position: 'relative', 
                    cursor: 'pointer',
                    '&:hover .event-card': { transform: 'translateY(-10px)' },
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}
                >
                  {/* Top content for even, bottom for odd to stagger */}
                  <Card
                    className="event-card"
                    sx={{
                      width: '100%',
                      borderRadius: 4,
                      bgcolor: '#ffffff',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                      transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                      mb: 8,
                      border: `1px solid ${ProfileColors.outlineVariant}30`
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                         <Typography
                          variant="caption"
                          sx={{
                            color: config.color,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: 1.5,
                          }}
                        >
                          {formatEventDate(event.date, event.datePrecision)}
                        </Typography>
                        <Icon sx={{ color: config.color, fontSize: 24, opacity: 0.8 }} />
                      </Box>
                     
                      <Typography 
                        variant="h6" 
                        className="serif-font"
                        sx={{ 
                          color: ProfileColors.primary, 
                          mb: 1.5, 
                          fontWeight: 700,
                          fontSize: '1.25rem'
                        }}
                      >
                        {event.title}
                      </Typography>

                      {event.metadata?.imageAssetId && (
                        <Box sx={{ mb: 2, borderRadius: 2, overflow: 'hidden', height: 100 }}>
                          <Box 
                            component="img"
                            src={`/api/assets/serve/${event.metadata.imageAssetId}`}
                            alt={event.title}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </Box>
                      )}

                      {event.description && (
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: ProfileColors.onSurfaceVariant, 
                            lineHeight: 1.6,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            mb: 2
                          }}
                        >
                          {event.description}
                        </Typography>
                      )}

                      <Box sx={{ display: 'flex', gap: 1, mt: 'auto' }}>
                        {event.people.map((p) => (
                          <Avatar 
                            key={p.id} 
                            src={p.avatarAssetId ? `/api/assets/serve/${p.avatarAssetId}` : undefined}
                            sx={{ width: 24, height: 24 }}
                          >
                            {p.firstName[0]}
                          </Avatar>
                        ))}
                      </Box>
                    </CardContent>
                  </Card>

                  {/* Connector Dot */}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 40,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      bgcolor: config.color,
                      border: `4px solid ${ProfileColors.surface}`,
                      boxShadow: `0 0 0 2px ${config.color}40`,
                      zIndex: 10,
                    }}
                  />
                  
                  {/* Vertical line to dot */}
                  <Box sx={{ 
                    position: 'absolute', 
                    bottom: 56, 
                    width: 2, 
                    height: 16, 
                    bgcolor: `${config.color}40` 
                  }} />
                </Box>
              )
            })}
          </Box>
          <Box sx={{ textAlign: 'center', mt: -2, opacity: 0.5 }}>
            <Typography variant="caption" sx={{ color: ProfileColors.onSurfaceVariant }}>
              drag to explore timeline
            </Typography>
          </Box>
        </Box>
      )}

      {/* Load More */}
      {hasMore && (
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Button
            variant="outlined"
            onClick={onLoadMore}
            disabled={isLoading}
            sx={{
              borderColor: ProfileColors.primary,
              color: ProfileColors.primary,
              '&:hover': {
                borderColor: ProfileColors.primaryContainer,
                bgcolor: 'rgba(22, 51, 74, 0.04)',
              },
              borderRadius: 2,
              px: 4
            }}
          >
            {isLoading ? 'Loading...' : 'Load More Events'}
          </Button>
        </Box>
      )}

      {/* Event Detail Dialog */}
      <Dialog 
        open={isDetailDialogOpen} 
        onClose={handleCloseDetail} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: { borderRadius: 4, overflow: 'hidden' }
        }}
      >
        {selectedEvent && (
          <>
            <Box sx={{ 
              bgcolor: eventTypeConfig[selectedEvent.type]?.color || ProfileColors.primary, 
              height: 80, 
              display: 'flex', 
              alignItems: 'center', 
              px: 3,
              color: 'white'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                {(() => {
                  const Icon = eventTypeConfig[selectedEvent.type]?.icon || CustomIcon
                  return <Icon sx={{ fontSize: 32 }} />
                })()}
                <Typography variant="h5" className="serif-font" sx={{ fontWeight: 700 }}>
                  {eventTypeConfig[selectedEvent.type]?.label || 'Event'} Details
                </Typography>
              </Box>
              <IconButton onClick={handleCloseDetail} sx={{ color: 'white' }}>
                <CloseIcon />
              </IconButton>
            </Box>
            
            <DialogContent sx={{ p: 4 }}>
              {selectedEvent.metadata?.imageAssetId && (
                <Box sx={{ mb: 3, borderRadius: 3, overflow: 'hidden', boxShadow: 2 }}>
                  <Box 
                    component="img"
                    src={`/api/assets/serve/${selectedEvent.metadata.imageAssetId}`}
                    alt={selectedEvent.title}
                    sx={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                </Box>
              )}

              <Typography
                variant="subtitle2"
                sx={{
                  color: eventTypeConfig[selectedEvent.type]?.color || ProfileColors.primary,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: 2,
                  mb: 1
                }}
              >
                {formatEventDate(selectedEvent.date, selectedEvent.datePrecision)}
              </Typography>
              
              <Typography variant="h4" className="serif-font" sx={{ color: ProfileColors.primary, mb: 3, fontWeight: 700 }}>
                {selectedEvent.title}
              </Typography>

              {selectedEvent.description && (
                <Box sx={{ mb: 4 }}>
                  <Typography variant="overline" sx={{ color: ProfileColors.onSurfaceVariant, fontWeight: 700 }}>
                    Description
                  </Typography>
                  <Typography variant="body1" sx={{ color: ProfileColors.onSurface, lineHeight: 1.7 }}>
                    {selectedEvent.description}
                  </Typography>
                </Box>
              )}

              <Box sx={{ mb: 4 }}>
                <Typography variant="overline" sx={{ color: ProfileColors.onSurfaceVariant, fontWeight: 700, display: 'block', mb: 1 }}>
                  People Involved
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {selectedEvent.people.map((p) => (
                    <Chip
                      key={p.id}
                      avatar={
                        <Avatar 
                          src={p.avatarAssetId ? `/api/assets/serve/${p.avatarAssetId}` : undefined}
                        >
                          {p.firstName[0]}
                        </Avatar>
                      }
                      label={getPersonDisplayName(p)}
                      variant="outlined"
                      sx={{ py: 2.5, px: 0.5, borderRadius: 2 }}
                    />
                  ))}
                </Box>
              </Box>

              {selectedEvent.sourceId && (
                <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: ProfileColors.surfaceContainerLow, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: ProfileColors.primary }}>
                      View full {selectedEvent.sourceType}
                    </Typography>
                    <Typography variant="caption" sx={{ color: ProfileColors.onSurfaceVariant }}>
                      Click to read the complete story or view the document.
                    </Typography>
                  </Box>
                  <Button 
                    component={Link}
                    href={selectedEvent.sourceType === 'story' ? `/stories/${selectedEvent.sourceId}` : `/documents/${selectedEvent.sourceId}`}
                    variant="contained" 
                    size="small"
                    endIcon={<ArrowForwardIcon />}
                    sx={{ bgcolor: ProfileColors.primary }}
                  >
                    Open
                  </Button>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ p: 3, bgcolor: ProfileColors.surface }}>
              <Button onClick={handleCloseDetail} variant="text" sx={{ color: ProfileColors.onSurfaceVariant }}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Add Event Dialog */}
      <Dialog open={isAddDialogOpen} onClose={handleCloseAddDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Add Timeline Event
          <IconButton onClick={handleCloseAddDialog} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            {submitError && (
              <Typography color="error" variant="body2">
                {submitError}
              </Typography>
            )}
            
            <FormControl fullWidth required>
              <InputLabel>Person</InputLabel>
              <Select
                value={newEvent.personId}
                onChange={(e) => setNewEvent({ ...newEvent, personId: e.target.value })}
                label="Person"
              >
                {people.map((person) => (
                  <MenuItem key={person.id} value={person.id}>
                    {getPersonDisplayName(person)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel>Event Type</InputLabel>
              <Select
                value={newEvent.eventType}
                onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value })}
                label="Event Type"
              >
                <MenuItem value="CUSTOM">Custom Event</MenuItem>
                <MenuItem value="EDUCATION">Education</MenuItem>
                <MenuItem value="OCCUPATION">Occupation</MenuItem>
                <MenuItem value="RESIDENCE">Residence</MenuItem>
                <MenuItem value="BIRTH">Birth</MenuItem>
                <MenuItem value="DEATH">Death</MenuItem>
                <MenuItem value="MARRIAGE">Marriage</MenuItem>
              </Select>
            </FormControl>

            <TextField
              type="date"
              label="Event Date"
              value={newEvent.eventDate}
              onChange={(e) => setNewEvent({ ...newEvent, eventDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />

            <TextField
              label="Event Title"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              placeholder="e.g., Graduated College, First Job, Moved to Boston"
              fullWidth
              required
            />

            <TextField
              label="Description"
              value={newEvent.description}
              onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              placeholder="Add more details about this event..."
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseAddDialog} variant="outlined">
            Cancel
          </Button>
          <Button
            onClick={handleSubmitEvent}
            variant="contained"
            disabled={isSubmitting}
            sx={{
              bgcolor: ProfileColors.primary,
              '&:hover': { bgcolor: ProfileColors.primaryContainer },
            }}
          >
            {isSubmitting ? 'Creating...' : 'Add Event'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
