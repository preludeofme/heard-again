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

export function TimelinePageComponent({ events, isLoading, hasMore, onLoadMore }: TimelinePageProps) {
  const { selectedFamilyMember } = useSelectedFamilyMember()
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['all'])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

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
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" className="serif-font" sx={{ color: '#16334a', mb: 2 }}>
          Family Timeline
        </Typography>
        <Typography variant="body1" sx={{ color: '#546669' }}>
          {selectedFamilyMember
            ? `Showing events for ${selectedFamilyMember.firstName}${selectedFamilyMember.lastName ? ` ${selectedFamilyMember.lastName}` : ''}`
            : 'Showing all family events across generations'}
        </Typography>
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
                : 'No events in the family timeline yet. Add stories, documents, or people to build your family history.'}
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
    </Box>
  )
}
