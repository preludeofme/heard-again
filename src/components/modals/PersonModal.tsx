import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Avatar, Tabs, Tab, Chip, IconButton, Grid,
  Divider, Card, CardContent, MenuItem, CircularProgress, Alert,
} from '@mui/material'
import {
  Close, Edit, Save, Delete, Person, CalendarToday, Tag,
  Mic, AutoStories, FamilyRestroom, Cancel,
} from '@mui/icons-material'
import { format } from 'date-fns'

interface VoiceProfile {
  id: string
  name: string
  isDefault: boolean
  isCloned: boolean
  createdAt: string
}

interface Relationship {
  id: string
  type: string
  direction: 'outgoing' | 'incoming'
  isBiological?: boolean
  person: {
    id: string
    firstName: string
    lastName?: string
    avatarAssetId?: string
  }
}

interface PersonData {
  id: string
  firstName: string
  lastName?: string
  displayName: string
  middleName?: string
  nickname?: string
  maidenName?: string
  suffix?: string
  personType: string
  birthDate?: string
  deathDate?: string
  isDeceased: boolean
  bio?: string
  avatarUrl?: string
  tags: string[]
  voiceProfiles: VoiceProfile[]
  relationships: Relationship[]
  counts: {
    storiesAsSubject: number
    storiesAsSpeaker: number
    voiceProfiles: number
  }
  createdAt: string
  updatedAt: string
}

interface PersonModalProps {
  open: boolean
  personId: string | null
  initialTab?: 'overview' | 'relationships'
  onClose: () => void
  onSave?: (person: PersonData) => void
  onDelete?: (personId: string) => void
}

const PERSON_TYPES = [
  { value: 'LIVING', label: 'Living' },
  { value: 'DECEASED', label: 'Deceased' },
  { value: 'ANCESTOR', label: 'Ancestor' },
  { value: 'DESCENDANT', label: 'Descendant' },
]

const RELATIONSHIP_TYPES = [
  { value: 'PARENT', label: 'Is parent of selected person' },
  { value: 'CHILD', label: 'Is child of selected person' },
  { value: 'SPOUSE', label: 'Is spouse/partner of selected person' },
]

const RELATIONSHIP_KINDS = [
  { value: 'BIOLOGICAL', label: 'Biological' },
  { value: 'ADOPTED', label: 'Adopted' },
  { value: 'STEP', label: 'Step' },
]

export function PersonModal({ open, personId, initialTab = 'overview', onClose, onSave, onDelete }: PersonModalProps) {
  const [person, setPerson] = useState<PersonData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [availablePeople, setAvailablePeople] = useState<Array<{ id: string; firstName: string; lastName?: string }>>([])
  const [relationshipTargetId, setRelationshipTargetId] = useState('')
  const [relationshipType, setRelationshipType] = useState('PARENT')
  const [relationshipKind, setRelationshipKind] = useState<'BIOLOGICAL' | 'ADOPTED' | 'STEP'>('BIOLOGICAL')
  const [marriageDate, setMarriageDate] = useState('')
  const [marriagePlace, setMarriagePlace] = useState('')
  const [isMutatingRelationship, setIsMutatingRelationship] = useState(false)

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<PersonData>>({})

  const fetchPerson = useCallback(async () => {
    if (!personId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/people/${personId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load person')
      setPerson(data.data)
      setEditForm(data.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [personId])

  const loadAvailablePeople = useCallback(async () => {
    if (!personId) return
    try {
      const res = await fetch('/api/people')
      const data = await res.json()
      if (res.ok && data.success) {
        const people = (data.data || []).filter((p: any) => p.id !== personId)
        setAvailablePeople(people)
      }
    } catch {
      setAvailablePeople([])
    }
  }, [personId])

  useEffect(() => {
    if (open && personId) {
      fetchPerson()
      loadAvailablePeople()
      setIsEditing(false)
      setActiveTab(initialTab === 'relationships' ? 1 : 0)
    }
  }, [open, personId, initialTab, fetchPerson, loadAvailablePeople])

  const handleCreateRelationship = async () => {
    if (!personId || !relationshipTargetId) return
    setIsMutatingRelationship(true)
    setError(null)
    try {
      const payload: any = {
        targetPersonId: relationshipTargetId,
        relationshipType,
        relationshipKind: relationshipType === 'SPOUSE' ? undefined : relationshipKind,
        isBiological: relationshipType === 'SPOUSE' ? true : relationshipKind === 'BIOLOGICAL',
      }
      if (relationshipType === 'SPOUSE') {
        if (marriageDate) payload.marriageDate = marriageDate
        if (marriagePlace) payload.marriagePlace = marriagePlace
      }
      const res = await fetch(`/api/people/${personId}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create relationship')
      setRelationshipTargetId('')
      setMarriageDate('')
      setMarriagePlace('')
      await fetchPerson()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsMutatingRelationship(false)
    }
  }

  const handleDeleteRelationship = async (relationshipId: string) => {
    if (!confirm('Remove this relationship?')) return
    setIsMutatingRelationship(true)
    setError(null)
    try {
      const encodedId = encodeURIComponent(relationshipId)
      const res = await fetch(`/api/relationships/${encodedId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete relationship')
      await fetchPerson()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsMutatingRelationship(false)
    }
  }

  const handleSave = async () => {
    if (!personId || !person) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/people/${personId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setPerson(data.data)
      setIsEditing(false)
      onSave?.(data.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!personId || !confirm('Are you sure you want to delete this person? This cannot be undone.')) return
    try {
      await fetch(`/api/people/${personId}`, { method: 'DELETE' })
      onDelete?.(personId)
      onClose()
    } catch {
      setError('Failed to delete person')
    }
  }

  const handleFormChange = (field: keyof PersonData, value: any) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
  }

  const handleClose = () => {
    if (isEditing && !confirm('Discard unsaved changes?')) return
    setIsEditing(false)
    onClose()
  }

  if (isLoading) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </DialogContent>
      </Dialog>
    )
  }

  if (!person) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogContent>
          <Alert severity="error">{error || 'Person not found'}</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      {/* Header with avatar and name */}
      <DialogTitle sx={{ px: 4, pt: 4, pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <Avatar
              src={person.avatarUrl || undefined}
              sx={{ width: 80, height: 80, border: '4px solid #d0e3e6' }}
            >
              <Person sx={{ fontSize: 40 }} />
            </Avatar>
            <Box>
              {isEditing ? (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <TextField
                    size="small"
                    label="First Name"
                    value={editForm.firstName || ''}
                    onChange={(e) => handleFormChange('firstName', e.target.value)}
                    sx={{ width: 140 }}
                  />
                  <TextField
                    size="small"
                    label="Last Name"
                    value={editForm.lastName || ''}
                    onChange={(e) => handleFormChange('lastName', e.target.value)}
                    sx={{ width: 140 }}
                  />
                </Box>
              ) : (
                <Typography variant="h4" sx={{ fontWeight: 600, color: '#16334a' }}>
                  {person.displayName}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                <Chip
                  size="small"
                  label={person.personType}
                  sx={{ backgroundColor: '#d0e3e6', color: '#16334a' }}
                />
                {person.isDeceased && (
                  <Chip
                    size="small"
                    label="Deceased"
                    sx={{ backgroundColor: '#f6f3ee', color: '#666' }}
                  />
                )}
              </Box>
            </Box>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      {error && (
        <Alert severity="error" sx={{ mx: 4, mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="Overview" />
          <Tab label={`Relationships (${person.relationships.length})`} />
          <Tab label={`Voice Profiles (${person.voiceProfiles.length})`} />
          <Tab label={`Stories (${person.counts.storiesAsSubject})`} />
        </Tabs>
      </Box>

      <DialogContent sx={{ px: 4, py: 3, minHeight: 300 }}>
        {/* Overview Tab */}
        {activeTab === 0 && (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" sx={{ color: '#666', mb: 2, fontWeight: 600 }}>
                Personal Information
              </Typography>
              {isEditing ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    size="small"
                    label="Middle Name"
                    value={editForm.middleName || ''}
                    onChange={(e) => handleFormChange('middleName', e.target.value)}
                  />
                  <TextField
                    size="small"
                    label="Nickname"
                    value={editForm.nickname || ''}
                    onChange={(e) => handleFormChange('nickname', e.target.value)}
                  />
                  <TextField
                    size="small"
                    label="Maiden Name"
                    value={editForm.maidenName || ''}
                    onChange={(e) => handleFormChange('maidenName', e.target.value)}
                  />
                  <TextField
                    size="small"
                    label="Suffix"
                    value={editForm.suffix || ''}
                    onChange={(e) => handleFormChange('suffix', e.target.value)}
                  />
                  <TextField
                    select
                    size="small"
                    label="Person Type"
                    value={editForm.personType || 'LIVING'}
                    onChange={(e) => handleFormChange('personType', e.target.value)}
                  >
                    {PERSON_TYPES.map((t) => (
                      <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                    ))}
                  </TextField>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {person.middleName && (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Person sx={{ fontSize: 18, color: '#546669' }} />
                      <Typography variant="body2" color="text.secondary">Middle:</Typography>
                      <Typography variant="body2">{person.middleName}</Typography>
                    </Box>
                  )}
                  {person.nickname && (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Tag sx={{ fontSize: 18, color: '#546669' }} />
                      <Typography variant="body2" color="text.secondary">Nickname:</Typography>
                      <Typography variant="body2">{person.nickname}</Typography>
                    </Box>
                  )}
                  {person.maidenName && (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Person sx={{ fontSize: 18, color: '#546669' }} />
                      <Typography variant="body2" color="text.secondary">Maiden Name:</Typography>
                      <Typography variant="body2">{person.maidenName}</Typography>
                    </Box>
                  )}
                  {person.suffix && (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Person sx={{ fontSize: 18, color: '#546669' }} />
                      <Typography variant="body2" color="text.secondary">Suffix:</Typography>
                      <Typography variant="body2">{person.suffix}</Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" sx={{ color: '#666', mb: 2, fontWeight: 600 }}>
                Life Dates
              </Typography>
              {isEditing ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    size="small"
                    type="date"
                    label="Birth Date"
                    value={editForm.birthDate ? editForm.birthDate.split('T')[0] : ''}
                    onChange={(e) => handleFormChange('birthDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    size="small"
                    type="date"
                    label="Death Date"
                    value={editForm.deathDate ? editForm.deathDate.split('T')[0] : ''}
                    onChange={(e) => handleFormChange('deathDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    disabled={!editForm.isDeceased}
                  />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {person.birthDate && (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <CalendarToday sx={{ fontSize: 18, color: '#546669' }} />
                      <Typography variant="body2" color="text.secondary">Born:</Typography>
                      <Typography variant="body2">
                        {format(new Date(person.birthDate), 'MMMM d, yyyy')}
                      </Typography>
                    </Box>
                  )}
                  {person.deathDate && (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <CalendarToday sx={{ fontSize: 18, color: '#546669' }} />
                      <Typography variant="body2" color="text.secondary">Died:</Typography>
                      <Typography variant="body2">
                        {format(new Date(person.deathDate), 'MMMM d, yyyy')}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ color: '#666', mb: 2, fontWeight: 600 }}>
                Biography
              </Typography>
              {isEditing ? (
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  value={editForm.bio || ''}
                  onChange={(e) => handleFormChange('bio', e.target.value)}
                  placeholder="Write a brief biography..."
                />
              ) : (
                <Typography variant="body2" sx={{ color: '#666', lineHeight: 1.6 }}>
                  {person.bio || 'No biography added yet.'}
                </Typography>
              )}
            </Grid>

            {person.tags.length > 0 && (
              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {person.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" sx={{ backgroundColor: '#f6f3ee' }} />
                  ))}
                </Box>
              </Grid>
            )}
          </Grid>
        )}

        {/* Relationships Tab */}
        {activeTab === 1 && (
          <Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <TextField
                select
                size="small"
                label="Related Person"
                value={relationshipTargetId}
                onChange={(e) => setRelationshipTargetId(e.target.value)}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">Select person</MenuItem>
                {availablePeople.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.firstName} {p.lastName || ''}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Type"
                value={relationshipType}
                onChange={(e) => setRelationshipType(e.target.value)}
                sx={{ minWidth: 180 }}
              >
                {RELATIONSHIP_TYPES.map((r) => (
                  <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                ))}
              </TextField>
              {(relationshipType === 'PARENT' || relationshipType === 'CHILD') && (
                <TextField
                  select
                  size="small"
                  label="Kind"
                  value={relationshipKind}
                  onChange={(e) => setRelationshipKind(e.target.value as 'BIOLOGICAL' | 'ADOPTED' | 'STEP')}
                  sx={{ minWidth: 160 }}
                >
                  {RELATIONSHIP_KINDS.map((kind) => (
                    <MenuItem key={kind.value} value={kind.value}>{kind.label}</MenuItem>
                  ))}
                </TextField>
              )}
              {relationshipType === 'SPOUSE' && (
                <>
                  <TextField
                    size="small"
                    type="date"
                    label="Marriage Date"
                    value={marriageDate}
                    onChange={(e) => setMarriageDate(e.target.value)}
                    sx={{ minWidth: 160 }}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    size="small"
                    label="Marriage Place"
                    value={marriagePlace}
                    onChange={(e) => setMarriagePlace(e.target.value)}
                    placeholder="City, State"
                    sx={{ minWidth: 180 }}
                  />
                </>
              )}
              <Button
                variant="contained"
                onClick={handleCreateRelationship}
                disabled={!relationshipTargetId || isMutatingRelationship}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                {isMutatingRelationship ? 'Saving...' : 'Add Relationship'}
              </Button>
            </Box>

            {/* Relationship description preview */}
            {relationshipTargetId && (
              <Box sx={{ mb: 2, p: 1.5, backgroundColor: '#e8f4e8', borderRadius: 2, border: '1px solid #c3e6c3' }}>
                <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 500 }}>
                  {(() => {
                    const targetPerson = availablePeople.find((p) => p.id === relationshipTargetId)
                    const targetName = targetPerson ? `${targetPerson.firstName}${targetPerson.lastName ? ` ${targetPerson.lastName}` : ''}` : '...'
                    const subjectName = person.displayName || person.firstName
                    if (relationshipType === 'PARENT') return `${subjectName} is a parent of ${targetName}`
                    if (relationshipType === 'CHILD') return `${subjectName} is a child of ${targetName}`
                    if (relationshipType === 'SPOUSE') return `${subjectName} is spouse/partner of ${targetName}`
                    return ''
                  })()}
                </Typography>
              </Box>
            )}

            {person.relationships.length === 0 ? (
              <EmptyTabState icon={<FamilyRestroom />} message="No relationships added yet" />
            ) : (
              <Grid container spacing={2}>
                {person.relationships.map((rel) => (
                  <Grid key={rel.id} size={{ xs: 12, sm: 6 }}>
                    <Card variant="outlined" sx={{ borderRadius: 2 }}>
                      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
                        <Avatar sx={{ width: 40, height: 40 }}>
                          {rel.person.firstName[0]}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2">
                            {rel.person.firstName} {rel.person.lastName || ''}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {rel.type} • {rel.direction === 'outgoing' ? 'To' : 'From'}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteRelationship(rel.id)}
                          disabled={isMutatingRelationship}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        )}

        {/* Voice Profiles Tab */}
        {activeTab === 2 && (
          <Box>
            {person.voiceProfiles.length === 0 ? (
              <EmptyTabState icon={<Mic />} message="No voice profiles yet" />
            ) : (
              <Grid container spacing={2}>
                {person.voiceProfiles.map((profile) => (
                  <Grid key={profile.id} size={{ xs: 12, sm: 6 }}>
                    <Card variant="outlined" sx={{ borderRadius: 2 }}>
                      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            backgroundColor: profile.isCloned ? '#d0e3e6' : '#feddb4',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Mic sx={{ fontSize: 20, color: profile.isCloned ? '#16334a' : '#402e11' }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2">{profile.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {profile.isCloned ? 'Cloned' : 'Designed'} {profile.isDefault && '• Default'}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        )}

        {/* Stories Tab */}
        {activeTab === 3 && (
          <EmptyTabState
            icon={<AutoStories />}
            message={`${person.counts.storiesAsSubject} stories about this person`}
            submessage="Stories can be viewed from the Stories page"
          />
        )}
      </DialogContent>

      <DialogActions sx={{ px: 4, py: 3, justifyContent: 'space-between' }}>
        <Box>
          {isEditing && (
            <Button
              startIcon={<Delete />}
              color="error"
              onClick={handleDelete}
              sx={{ textTransform: 'none' }}
            >
              Delete
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {isEditing ? (
            <>
              <Button
                startIcon={<Cancel />}
                onClick={() => {
                  setEditForm(person)
                  setIsEditing(false)
                  setError(null)
                }}
                sx={{ textTransform: 'none' }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSave}
                disabled={isSaving}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              startIcon={<Edit />}
              onClick={() => setIsEditing(true)}
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              Edit Person
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  )
}

function EmptyTabState({ icon, message, submessage }: { icon: React.ReactNode; message: string; submessage?: string }) {
  return (
    <Box sx={{ textAlign: 'center', py: 8 }}>
      <Box sx={{ color: '#d0e3e6', mb: 2 }}>{icon}</Box>
      <Typography variant="body1" sx={{ color: '#666' }}>
        {message}
      </Typography>
      {submessage && (
        <Typography variant="caption" sx={{ color: '#999', mt: 1, display: 'block' }}>
          {submessage}
        </Typography>
      )}
    </Box>
  )
}
