import { useState, useEffect, useMemo } from 'react'
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
} from '@mui/icons-material'
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

const datePrecisionLabels: Record<string, string> = {
  EXACT: '',
  YEAR_MONTH: ' (month known)',
  YEAR: ' (year only)',
  DECADE: 's',
  APPROXIMATE: ' (approx.)',
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

function getPersonDisplayName(person: TimelineEvent['people'][0]): string {
  return person.displayName || `${person.firstName} ${person.lastName || ''}`.trim()
}

export function TimelinePageComponent({ events, isLoading, hasMore, onLoadMore, onEventCreated, people = [] }: TimelinePageProps) {
  const { selectedFamilyMember } = useSelectedFamilyMember()
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['all'])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  
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

  if (isLoading && events.length === 0) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4', px: { xs: 3, md: 8 }, py: 6 }}>
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
    <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4', px: { xs: 3, md: 8 }, py: 6 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h3" className="serif-font" sx={{ color: '#16334a', mb: 2 }}>
            Family Timeline
          </Typography>
          <Typography variant="body1" sx={{ color: '#546669' }}>
            {selectedFamilyMember
              ? `Showing events for ${selectedFamilyMember.firstName}${selectedFamilyMember.lastName ? ` ${selectedFamilyMember.lastName}` : ''}`
              : 'Showing all family events across generations'}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAddDialog}
          sx={{
            bgcolor: '#16334a',
            color: 'white',
            '&:hover': { bgcolor: '#2e4a62' },
            borderRadius: 2,
            px: 3,
          }}
        >
          Add Event
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 4, borderRadius: 3, bgcolor: '#ffffff' }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: { xs: 'stretch', md: 'center' } }}>
            <ToggleButtonGroup
              value={selectedTypes}
              onChange={handleTypeChange}
              aria-label="event types"
              size="small"
              sx={{ flexWrap: 'wrap' }}
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

            <Box sx={{ display: 'flex', gap: 2, flex: 1, justifyContent: { xs: 'stretch', md: 'flex-end' } }}>
              <TextField
                type="date"
                label="From"
                size="small"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 140 }}
              />
              <TextField
                type="date"
                label="To"
                size="small"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 140 }}
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Timeline */}
      {filteredEvents.length === 0 ? (
        <Card sx={{ borderRadius: 3, textAlign: 'center', py: 8 }}>
          <CardContent>
            <TimelineIcon sx={{ fontSize: 60, color: '#adcae6', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#16334a', mb: 1 }}>
              No events found
            </Typography>
            <Typography variant="body2" sx={{ color: '#546669' }}>
            {selectedFamilyMember
              ? 'No events found for this family member. Try adjusting your filters or select a different person.'
              : 'No events in the family timeline yet. Add stories, documents, or click "Add Event" to build your family history.'}
          </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          <Timeline position="alternate">
            {filteredEvents.map((event, index) => {
              const config = eventTypeConfig[event.type]
              const Icon = config.icon

              return (
                <Fade in timeout={300} key={event.id}>
                  <TimelineItem>
                    <TimelineSeparator>
                      <TimelineDot
                        sx={{
                          bgcolor: config.color,
                          color: 'white',
                          p: 1,
                        }}
                      >
                        <Icon sx={{ fontSize: 20 }} />
                      </TimelineDot>
                      {index < filteredEvents.length - 1 && <TimelineConnector />}
                    </TimelineSeparator>
                    <TimelineContent>
                      <Card
                        sx={{
                          borderRadius: 3,
                          bgcolor: '#ffffff',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 3,
                          },
                        }}
                      >
                        <CardContent>
                          {/* Date */}
                          <Typography
                            variant="caption"
                            sx={{
                              color: config.color,
                              fontWeight: 600,
                              display: 'block',
                              mb: 1,
                            }}
                          >
                            {formatEventDate(event.date, event.datePrecision)}
                          </Typography>

                          {/* Title */}
                          <Typography variant="h6" sx={{ color: '#16334a', mb: 1 }}>
                            {event.title}
                          </Typography>

                          {/* Description */}
                          {event.description && (
                            <Typography variant="body2" sx={{ color: '#546669', mb: 2 }}>
                              {event.description}
                            </Typography>
                          )}

                          {/* People Chips */}
                          {event.people.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                              {event.people.map((person) => (
                                <Chip
                                  key={person.id}
                                  avatar={
                                    <Avatar
                                      src={person.avatarAssetId ? `/api/assets/${person.avatarAssetId}` : undefined}
                                      sx={{ width: 24, height: 24 }}
                                    >
                                      {person.firstName[0]}
                                    </Avatar>
                                  }
                                  label={getPersonDisplayName(person)}
                                  size="small"
                                  sx={{
                                    bgcolor: '#f6f3ee',
                                    color: '#16334a',
                                    '& .MuiChip-avatar': {
                                      bgcolor: '#adcae6',
                                    },
                                  }}
                                />
                              ))}
                            </Box>
                          )}

                          {/* Metadata */}
                          {event.metadata?.documentType && (
                            <Chip
                              label={event.metadata.documentType}
                              size="small"
                              sx={{
                                mt: 2,
                                bgcolor: '#e3f2fd',
                                color: '#1565c0',
                              }}
                            />
                          )}
                        </CardContent>
                      </Card>
                    </TimelineContent>
                  </TimelineItem>
                </Fade>
              )
            })}
          </Timeline>

          {/* Load More */}
          {hasMore && (
            <Box sx={{ textAlign: 'center', mt: 4 }}>
              <Button
                variant="outlined"
                onClick={onLoadMore}
                disabled={isLoading}
                sx={{
                  borderColor: '#16334a',
                  color: '#16334a',
                  '&:hover': {
                    borderColor: '#2e4a62',
                    bgcolor: 'rgba(22, 51, 74, 0.04)',
                  },
                }}
              >
                {isLoading ? 'Loading...' : 'Load More Events'}
              </Button>
            </Box>
          )}
        </>
      )}

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
                    {person.displayName || `${person.firstName} ${person.lastName || ''}`.trim()}
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
              bgcolor: '#16334a',
              '&:hover': { bgcolor: '#2e4a62' },
            }}
          >
            {isSubmitting ? 'Creating...' : 'Add Event'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
