import { useState, useEffect, useMemo, useRef } from 'react'
import { fetchWithCSRFAndJSON } from '@/lib/api-client'
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
  Paper,
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
import { extractFirstImage, stripHtml } from '@/lib/html-utils'
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

function getPersonDisplayName(person: { firstName: string; lastName?: string | null; displayName?: string | null }): string {
  return person.displayName || `${person.firstName} ${person.lastName || ''}`.trim()
}

export function TimelinePageComponent({ events, isLoading, hasMore, onLoadMore, onEventCreated, people = [] }: TimelinePageProps) {
  const { selectedFamilyMember, setSelectedFamilyMember } = useSelectedFamilyMember()
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['all'])
  const [viewMode, setViewMode] = useState<'vertical' | 'horizontal'>('vertical')

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
    if (selectedTypes.includes('all')) return events
    return events.filter(e => selectedTypes.includes(e.type))
  }, [events, selectedTypes])

  const handleTypeChange = (type: string) => {
    if (type === 'all') {
      setSelectedTypes(['all'])
    } else {
      setSelectedTypes(prev => {
        const withoutAll = prev.filter(t => t !== 'all')
        if (withoutAll.includes(type)) {
          const next = withoutAll.filter(t => t !== type)
          return next.length === 0 ? ['all'] : next
        }
        return [...withoutAll, type]
      })
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
      const response = await fetchWithCSRFAndJSON('/api/timeline', {
        personId: newEvent.personId,
        eventType: newEvent.eventType,
        eventDate: new Date(newEvent.eventDate).toISOString(),
        title: newEvent.title,
        description: newEvent.description,
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
    <Box sx={{ minHeight: '100vh', backgroundColor: ProfileColors.surface, px: { xs: 2, md: 8 }, py: { xs: 4, md: 8 } }}>
      {/* Editorial Header */}
      <Box sx={{ mb: 6, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'flex-end' }, gap: 3 }}>
        <Box>
          <Typography
            sx={{
              fontFamily: 'var(--font-manrope), sans-serif',
              fontSize: '0.85rem',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: ProfileColors.onSurfaceVariant,
              mb: 1
            }}
          >
            The Timeline
          </Typography>
          <Typography
            variant="h2"
            className="serif-font"
            sx={{
              color: ProfileColors.primary,
              fontWeight: 700,
              fontSize: { xs: '2rem', md: '2rem' },
              lineHeight: 1,
              fontStyle: 'italic'
            }}
          >
            Life Journey
          </Typography>
          <Typography variant="body1" sx={{ color: ProfileColors.onSurfaceVariant, mt: 2, maxWidth: 500, fontFamily: 'var(--font-newsreader), serif', fontSize: '1.1rem' }}>
            {selectedFamilyMember
              ? `Exploring the milestones and memories of ${getPersonDisplayName(selectedFamilyMember)}.`
              : 'See your family’s stories, milestones, voices, and keepsakes come together over time.'}
          </Typography>
        </Box>
        
      </Box>

      {/* Simplified, Tactile Explore Bar */}
      {events.length > 0 && <Box 
        sx={{ 
          mb: 8, 
          display: 'flex', 
          flexDirection: { xs: 'column', lg: 'row' },
          gap: 3,
          alignItems: { lg: 'center' }
        }}
      >
        {/* Type Lenses */}
        <Paper
          elevation={0}
          sx={{
            display: 'flex',
            p: 0.75,
            borderRadius: '999px',
            backgroundColor: ProfileColors.surfaceContainerLow,
            border: `1px solid ${ProfileColors.outlineVariant}20`,
            overflowX: 'auto',
            '&::-webkit-scrollbar': { display: 'none' }
          }}
        >
          {([
            { label: 'All', value: 'all', icon: <TimelineIcon sx={{ fontSize: 18 }} /> },
            { label: 'Stories', value: 'story', icon: <StoryIcon sx={{ fontSize: 18 }} /> },
            { label: 'Milestones', value: 'custom', icon: <CustomIcon sx={{ fontSize: 18 }} /> },
            { label: 'Keepsakes', value: 'document', icon: <DocumentIcon sx={{ fontSize: 18 }} /> },
            { label: 'Life Events', value: 'birth', icon: <BirthIcon sx={{ fontSize: 18 }} /> }
          ] as const).map((opt) => (
            <Button
              key={opt.value}
              onClick={() => handleTypeChange(opt.value)}
              startIcon={opt.icon}
              sx={{
                px: 3,
                py: 1,
                borderRadius: '999px',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
                whiteSpace: 'nowrap',
                color: selectedTypes.includes(opt.value) ? ProfileColors.primary : ProfileColors.onSurfaceVariant,
                backgroundColor: selectedTypes.includes(opt.value) ? ProfileColors.surfaceContainerLowest : 'transparent',
                boxShadow: selectedTypes.includes(opt.value) ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                '&:hover': {
                  backgroundColor: selectedTypes.includes(opt.value) ? ProfileColors.surfaceContainerLowest : 'rgba(0,0,0,0.03)'
                }
              }}
            >
              {opt.label}
            </Button>
          ))}
        </Paper>

        <Box sx={{ flex: 1 }} />

        {/* View Switcher */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, next) => next && setViewMode(next)}
          sx={{
            backgroundColor: ProfileColors.surfaceContainerLow,
            borderRadius: '999px',
            p: 0.5,
            border: 'none',
            '& .MuiToggleButton-root': {
              border: 'none',
              borderRadius: '999px !important',
              px: 2,
              py: 0.75,
              color: ProfileColors.onSurfaceVariant,
              '&.Mui-selected': {
                backgroundColor: ProfileColors.surfaceContainerLowest,
                color: ProfileColors.primary,
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
              }
            }
          }}
        >
          <ToggleButton value="vertical" aria-label="vertical view">
            <VerticalIcon sx={{ fontSize: 20 }} />
          </ToggleButton>
          <ToggleButton value="horizontal" aria-label="horizontal view">
            <HorizontalIcon sx={{ fontSize: 20 }} />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>}

      {/* Journey Content */}
      {filteredEvents.length === 0 ? (
        <Box sx={{ py: 12, textAlign: 'center', backgroundColor: ProfileColors.surfaceContainerLow, borderRadius: 8, border: `2px dashed ${ProfileColors.outlineVariant}30` }}>
          <TimelineIcon sx={{ fontSize: 64, color: ProfileColors.outlineVariant, mb: 2, opacity: 0.5 }} />
          <Typography variant="h5" className="serif-font" sx={{ color: ProfileColors.primary, mb: 1 }}>
            Every legacy starts with one memory.
          </Typography>
          <Typography variant="body2" sx={{ color: ProfileColors.onSurfaceVariant, mb: 3, maxWidth: 640, mx: 'auto' }}>
            Add a story, voice memory, keepsake, milestone, or family member to begin building your family’s timeline.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
            <Button variant="contained" onClick={() => window.location.assign('/contribute')} sx={{ borderRadius: '999px', textTransform: 'none' }}>Add a Memory</Button>
            <Button variant="outlined" component={Link} href="/family-tree?add=1" sx={{ borderRadius: '999px', borderColor: ProfileColors.primary, color: ProfileColors.primary, textTransform: 'none' }}>
              Add a Family Member
            </Button>
          </Box>
          <Typography sx={{ fontWeight: 600, color: ProfileColors.primary, mb: 1 }}>Need a place to start?</Typography>
          <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, color: ProfileColors.onSurfaceVariant, display: 'grid', gap: 0.8 }}>
            <li>What is a story your family always tells?</li>
            <li>Who is someone you wish future generations could know better?</li>
            <li>Do you have an old voicemail, cassette, video, or recording worth saving?</li>
            <li>What photo deserves a story behind it?</li>
          </Box>
        </Box>
      ) : viewMode === 'vertical' ? (
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          <Timeline position="right" sx={{ p: 0 }}>
            {filteredEvents.map((event, index) => {
              const config = eventTypeConfig[event.type] || eventTypeConfig.custom
              const Icon = config.icon

              return (
                <TimelineItem key={event.id} sx={{ '&::before': { display: 'none' } }}>
                  <TimelineSeparator sx={{ mr: 4 }}>
                    <TimelineDot
                      sx={{
                        bgcolor: '#fff',
                        color: config.color,
                        border: `2px solid ${config.color}`,
                        p: 1.25,
                        boxShadow: 'none',
                        cursor: 'pointer',
                        '&:hover': { transform: 'scale(1.1)', bgcolor: ProfileColors.surfaceContainerLow },
                        transition: 'all 0.2s',
                      }}
                      onClick={() => handleOpenDetail(event)}
                    >
                      <Icon sx={{ fontSize: 20 }} />
                    </TimelineDot>
                    <TimelineConnector sx={{ bgcolor: ProfileColors.outlineVariant, opacity: 0.3, width: 2 }} />
                  </TimelineSeparator>
                  <TimelineContent sx={{ py: 0, pb: 8, px: 0 }}>
                    <Fade in timeout={500 + (index % 5) * 100}>
                      <Card
                        onClick={() => handleOpenDetail(event)}
                        sx={{
                          borderRadius: 5,
                          bgcolor: ProfileColors.surfaceContainerLowest,
                          boxShadow: '0 4px 24px rgba(0,0,0,0.03)',
                          border: `1px solid ${ProfileColors.outlineVariant}15`,
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          '&:hover': {
                            transform: 'translateY(-4px) translateX(4px)',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
                            borderColor: ProfileColors.primary + '30',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' } }}>
                          {event.metadata?.imageAssetId && (
                            <Box sx={{ width: { xs: '100%', sm: 180 }, height: { xs: 180, sm: 'auto' }, flexShrink: 0 }}>
                              <Box 
                                component="img"
                                src={`/api/assets/serve/${event.metadata.imageAssetId}`}
                                alt={event.title}
                                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            </Box>
                          )}
                          <CardContent sx={{ p: 4, flexGrow: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                              <Typography
                                sx={{
                                  color: config.color,
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                  textTransform: 'uppercase',
                                  letterSpacing: 2,
                                }}
                              >
                                {formatEventDate(event.date, event.datePrecision)}
                              </Typography>
                              <Chip 
                                label={config.label} 
                                size="small" 
                                sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: config.color + '15', color: config.color, border: 'none' }} 
                              />
                            </Box>

                            <Typography 
                              variant="h5" 
                              className="serif-font"
                              sx={{ 
                                color: ProfileColors.primary, 
                                mb: 1.5, 
                                fontWeight: 700,
                                lineHeight: 1.2
                              }}
                            >
                              {event.title}
                            </Typography>

                            {event.description && (
                              <>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    color: ProfileColors.onSurfaceVariant, 
                                    mb: event.type === 'story' && extractFirstImage(event.description) ? 1.5 : 3, 
                                    lineHeight: 1.7,
                                    fontFamily: 'var(--font-newsreader), serif',
                                    fontSize: '1rem',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                  }}
                                >
                                  {event.type === 'story' ? stripHtml(event.description) : event.description}
                                </Typography>
                                
                                {/* Inline image for stories if no side image is present */}
                                {event.type === 'story' && !event.metadata?.imageAssetId && (() => {
                                  const firstImg = extractFirstImage(event.description)
                                  if (firstImg) {
                                    return (
                                      <Box 
                                        sx={{ 
                                          width: '100%', 
                                          height: 120, 
                                          borderRadius: 2, 
                                          overflow: 'hidden', 
                                          mb: 3,
                                          border: '1px solid rgba(0,0,0,0.05)'
                                        }}
                                      >
                                        <Box component="img" src={firstImg} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      </Box>
                                    )
                                  }
                                  return null
                                })()}
                              </>
                            )}

                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Box sx={{ display: 'flex', gap: -0.5 }}>
                                {event.people.slice(0, 3).map((person) => (
                                  <Avatar
                                    key={person.id}
                                    src={person.avatarAssetId ? `/api/assets/serve/${person.avatarAssetId}` : undefined}
                                    sx={{ width: 28, height: 28, border: `2px solid #fff`, boxShadow: 1 }}
                                  >
                                    {person.firstName[0]}
                                  </Avatar>
                                ))}
                                {event.people.length > 3 && (
                                  <Avatar sx={{ width: 28, height: 28, fontSize: 10, bgcolor: ProfileColors.surfaceContainerHigh, color: ProfileColors.primary, fontWeight: 700, border: '2px solid #fff' }}>
                                    +{event.people.length - 3}
                                  </Avatar>
                                )}
                              </Box>
                              <ArrowForwardIcon sx={{ fontSize: 18, color: ProfileColors.outlineVariant, opacity: 0.5 }} />
                            </Box>
                          </CardContent>
                        </Box>
                      </Card>
                    </Fade>
                  </TimelineContent>
                </TimelineItem>
              )
            })}
            {/* Ghost card: prompt to add the next chapter */}
            <TimelineItem sx={{ '&::before': { display: 'none' } }}>
              <TimelineSeparator sx={{ mr: 4 }}>
                <TimelineDot
                  sx={{
                    bgcolor: 'transparent',
                    border: `2px dashed ${ProfileColors.outlineVariant}`,
                    p: 1.25,
                    boxShadow: 'none',
                  }}
                >
                  <AddIcon sx={{ fontSize: 20, color: ProfileColors.outlineVariant, opacity: 0.5 }} />
                </TimelineDot>
              </TimelineSeparator>
              <TimelineContent sx={{ py: 0, pb: 4, px: 0 }}>
                <Card
                  onClick={handleOpenAddDialog}
                  sx={{
                    borderRadius: 5,
                    bgcolor: 'transparent',
                    boxShadow: 'none',
                    border: `2px dashed ${ProfileColors.outlineVariant}30`,
                    opacity: 0.6,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      opacity: 1,
                      borderColor: ProfileColors.primary + '40',
                      bgcolor: ProfileColors.surfaceContainerLow,
                    },
                  }}
                >
                  <CardContent sx={{ p: 4, '&:last-child': { pb: 4 } }}>
                    <Typography
                      sx={{
                        fontFamily: 'var(--font-newsreader), serif',
                        fontSize: '1.1rem',
                        color: ProfileColors.onSurfaceVariant,
                        fontStyle: 'italic',
                      }}
                    >
                      Add the next chapter →
                    </Typography>
                  </CardContent>
                </Card>
              </TimelineContent>
            </TimelineItem>
          </Timeline>
        </Box>
      ) : (
        /* Horizontal Journey View */
        <Box sx={{ position: 'relative', py: 4, overflow: 'hidden' }}>
          <Box sx={{ 
            position: 'absolute', 
            top: '50%', 
            left: 0, 
            right: 0, 
            height: 1, 
            background: `linear-gradient(to right, transparent, ${ProfileColors.outlineVariant}50, transparent)`, 
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
              gap: 6,
              overflowX: 'auto',
              pb: 8,
              pt: 4,
              px: 10,
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
              scrollBehavior: isDragging ? 'auto' : 'smooth',
            }}
          >
            {filteredEvents.map((event, index) => {
              const config = eventTypeConfig[event.type] || eventTypeConfig.custom
              const Icon = config.icon
              const isEven = index % 2 === 0

              const mainCard = (
                <Card
                  className="event-card"
                  sx={{
                    width: '100%',
                    borderRadius: 5,
                    bgcolor: ProfileColors.surfaceContainerLowest,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                    transition: 'transform 0.4s ease, box-shadow 0.3s',
                    border: `1px solid ${ProfileColors.outlineVariant}15`,
                    overflow: 'hidden',
                    '&:hover': {
                      transform: isEven ? 'translateY(-6px)' : 'translateY(6px)',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.09)',
                    },
                  }}
                >
                  {event.metadata?.imageAssetId && (
                    <Box sx={{ height: 120, width: '100%' }}>
                      <Box
                        component="img"
                        src={`/api/assets/serve/${event.metadata.imageAssetId}`}
                        alt={event.title}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </Box>
                  )}
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
                      <Typography sx={{ color: config.color, fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                        {formatEventDate(event.date, event.datePrecision)}
                      </Typography>
                      <Chip label={config.label} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: config.color + '15', color: config.color, border: 'none' }} />
                    </Box>
                    <Typography className="serif-font" sx={{ color: ProfileColors.primary, fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.25, mb: 0.75 }}>
                      {event.title}
                    </Typography>
                    {event.description && (
                      <Typography sx={{ color: ProfileColors.onSurfaceVariant, lineHeight: 1.6, fontFamily: 'var(--font-newsreader), serif', fontSize: '0.85rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {event.type === 'story' ? stripHtml(event.description) : event.description}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              )

              const companionPanel = (
                <Box
                  sx={{
                    width: '100%',
                    borderRadius: 5,
                    bgcolor: ProfileColors.surfaceContainerLow,
                    border: `1px solid ${ProfileColors.outlineVariant}10`,
                    p: 2.5,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                    minHeight: 100,
                  }}
                >
                  <Box sx={{ display: 'flex', gap: -0.5 }}>
                    {event.people.slice(0, 3).map((person) => (
                      <Avatar
                        key={person.id}
                        src={person.avatarAssetId ? `/api/assets/serve/${person.avatarAssetId}` : undefined}
                        sx={{ width: 32, height: 32, border: '2px solid #fff', boxShadow: 1, fontSize: 12, bgcolor: config.color + '30', color: config.color }}
                      >
                        {person.firstName[0]}
                      </Avatar>
                    ))}
                    {event.people.length > 3 && (
                      <Avatar sx={{ width: 32, height: 32, fontSize: 10, bgcolor: ProfileColors.surfaceContainerHigh, color: ProfileColors.primary, fontWeight: 700, border: '2px solid #fff' }}>
                        +{event.people.length - 3}
                      </Avatar>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Icon sx={{ fontSize: 14, color: config.color, opacity: 0.7 }} />
                    <Typography sx={{ fontFamily: 'var(--font-manrope), sans-serif', fontSize: '0.7rem', fontWeight: 600, color: ProfileColors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {config.label}
                    </Typography>
                  </Box>
                </Box>
              )

              return (
                <Box
                  key={event.id}
                  onClick={() => handleOpenDetail(event)}
                  sx={{
                    flexShrink: 0,
                    width: 260,
                    position: 'relative',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0,
                  }}
                >
                  {isEven ? mainCard : companionPanel}

                  {/* Center dot */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 0.5, flexShrink: 0 }}>
                    <Box sx={{ width: 1.5, height: 12, bgcolor: `${config.color}40` }} />
                    <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: config.color, border: `3px solid #fff`, boxShadow: `0 0 0 2px ${config.color}30`, zIndex: 10 }} />
                    <Box sx={{ width: 1.5, height: 12, bgcolor: `${config.color}40` }} />
                  </Box>

                  {isEven ? companionPanel : mainCard}
                </Box>
              )
            })}
          </Box>
          <Box sx={{ textAlign: 'center', mt: 2, opacity: 0.4 }}>
            <Typography sx={{ fontFamily: 'var(--font-manrope), sans-serif', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              drag to explore journey
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
          Add a Life Moment
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
