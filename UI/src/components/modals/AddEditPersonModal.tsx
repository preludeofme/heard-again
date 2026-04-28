import React, { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  MenuItem,
  Avatar,
  Chip,
  Divider,
  Grid,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  Paper,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  Close as CloseIcon,
  Person as PersonIcon,
  ExpandMore as ExpandMoreIcon,
  Check as CheckIcon,
  AutoAwesome as AutoAwesomeIcon,
  Send as SendIcon,
  PhotoCamera as PhotoCameraIcon,
} from '@mui/icons-material'
import { PersonType } from '@/contracts'

export interface PersonFormData {
  firstName: string
  lastName: string
  displayName?: string
  nickname?: string
  maidenName?: string
  suffix?: string
  middleName?: string
  birthDate?: string
  deathDate?: string
  isDeceased?: boolean
  bio?: string
  personType: PersonType
  tags?: string[]
  relationshipTo?: string
  relationshipType?: 'PARENT' | 'CHILD' | 'SPOUSE'
  relationshipKind?: 'BIOLOGICAL' | 'ADOPTED' | 'STEP'
  marriageDate?: string
  marriagePlace?: string
  avatarFile?: File
}

export interface ExistingPerson {
  id: string
  firstName: string
  lastName?: string
}

interface AddEditPersonModalProps {
  open: boolean
  onClose: () => void
  person?: PersonFormData & { id?: string; avatarUrl?: string | null }
  mode: 'create' | 'edit'
  onSubmit: (data: PersonFormData) => Promise<void>
  isSubmitting?: boolean
  existingPeople?: ExistingPerson[]
}

const PERSON_TYPES = [
  { value: PersonType.FAMILY, label: 'Family', description: 'Family member - parents, grandparents, children, siblings' },
  { value: PersonType.FRIEND, label: 'Friend', description: 'Close friend or companion' },
  { value: PersonType.MENTOR, label: 'Mentor', description: 'Teacher, mentor, or guide' },
  { value: PersonType.COLLEAGUE, label: 'Colleague', description: 'Work colleague or professional connection' },
  { value: PersonType.OTHER, label: 'Other', description: 'Caregiver, or other significant person' },
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

export function AddEditPersonModal({
  open,
  onClose,
  person,
  mode,
  onSubmit,
  isSubmitting = false,
  existingPeople,
}: AddEditPersonModalProps) {
  const [isInterviewMode, setIsInterviewMode] = useState(false)
  const [interviewText, setInterviewText] = useState('')
  const [interviewMessages, setInterviewMessages] = useState<{role: 'system'|'user', content: string}[]>([
    { role: 'system', content: "Hi! Let's add a new person to your family tree. Tell me their name and how they are related to you." }
  ])

  const [formData, setFormData] = useState<PersonFormData>({
    firstName: '',
    lastName: '',
    displayName: '',
    nickname: '',
    maidenName: '',
    suffix: '',
    middleName: '',
    birthDate: '',
    deathDate: '',
    isDeceased: false,
    bio: '',
    personType: PersonType.FAMILY,
    tags: [],
  })
  const [errors, setErrors] = useState<Partial<Record<keyof PersonFormData, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof PersonFormData, boolean>>>({})
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (person && mode === 'edit') {
      setFormData({
        firstName: person.firstName || '',
        lastName: person.lastName || '',
        displayName: person.displayName || '',
        nickname: person.nickname || '',
        maidenName: person.maidenName || '',
        suffix: person.suffix || '',
        middleName: person.middleName || '',
        birthDate: person.birthDate || '',
        deathDate: person.deathDate || '',
        isDeceased: person.isDeceased || false,
        bio: person.bio || '',
        personType: person.personType || PersonType.FAMILY,
        tags: person.tags || [],
      })
      setAvatarPreviewUrl(person.avatarUrl || null)
    } else {
      setFormData({
        firstName: '',
        lastName: '',
        displayName: '',
        nickname: '',
        maidenName: '',
        suffix: '',
        middleName: '',
        birthDate: '',
        deathDate: '',
        isDeceased: false,
        bio: '',
        personType: PersonType.FAMILY,
        tags: [],
      })
      setInterviewMessages([{ role: 'system', content: "Hi! Let's add a new person to your family tree. Tell me their name and how they are related to you." }])
      setAvatarPreviewUrl(null)
    }
    setPendingAvatarFile(null)
    setAvatarError(null)
    setErrors({})
    setTouched({})
  }, [person, mode, open])

  useEffect(() => {
    if (!pendingAvatarFile) return
    const url = URL.createObjectURL(pendingAvatarFile)
    setAvatarPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingAvatarFile])

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError(null)
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file (JPG, PNG, etc.).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Photo must be under 5MB.')
      return
    }
    setPendingAvatarFile(file)
  }

  const handleAvatarPickClick = () => {
    avatarInputRef.current?.click()
  }

  const handleChange = (field: keyof PersonFormData, value: string | boolean) => {
    if (field === 'deathDate') {
      const deathDateValue = value as string
      const hasDeathDate = Boolean(deathDateValue)
      setFormData((prev) => ({ 
        ...prev, 
        [field]: deathDateValue,
        isDeceased: hasDeathDate 
      }))
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }))
    }
    
    setTouched((prev) => ({ ...prev, [field]: true }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof PersonFormData, string>> = {}
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }
    if (formData.birthDate && formData.deathDate) {
      const birth = new Date(formData.birthDate)
      const death = new Date(formData.deathDate)
      if (death < birth) {
        newErrors.deathDate = 'Death date cannot be before birth date'
      }
    }
    if (mode === 'create' && existingPeople?.length) {
      if (formData.relationshipTo && !formData.relationshipType) {
        newErrors.relationshipType = 'Please select a relationship type'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (validate()) {
      try {
        await onSubmit({ ...formData, avatarFile: pendingAvatarFile || undefined })
      } catch (error) {
        console.error('Failed to save person:', error)
        alert(`Error: ${error instanceof Error ? error.message : 'Failed to save person'}`)
      }
    }
  }

  const handleInterviewSubmit = () => {
    if (!interviewText.trim()) return
    setInterviewMessages(prev => [...prev, { role: 'user', content: interviewText }])
    const input = interviewText
    setInterviewText('')
    
    // Mock extraction logic
    setTimeout(() => {
      setInterviewMessages(prev => [...prev, { role: 'system', content: "Great, I've filled out what I could. Please review the details below before saving!" }])
      // Try a very naive parse
      const words = input.split(' ')
      if (words.length > 0) {
        setFormData(prev => ({
          ...prev,
          firstName: prev.firstName || words[0],
          lastName: prev.lastName || (words.length > 1 ? words[1] : ''),
          bio: prev.bio || input
        }))
      }
      setIsInterviewMode(false)
    }, 1000)
  }

  const getInitials = () => {
    return `${formData.firstName[0] || ''}${formData.lastName[0] || ''}`.toUpperCase()
  }

  return (
    <Dialog
      open={open}
      onClose={!isSubmitting ? onClose : undefined}
      maxWidth="sm"
      fullWidth
      aria-labelledby="add-edit-person-dialog-title"
      PaperProps={{
        sx: {
          borderRadius: 4,
          maxHeight: '90vh',
          backgroundColor: '#faf9f7',
        },
      }}
    >
      <DialogTitle id="add-edit-person-dialog-title" sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5" sx={{ color: '#16334a', fontWeight: 600, fontFamily: 'var(--font-newsreader), serif' }}>
            {mode === 'create' ? 'Add New Person' : 'Edit Person'}
          </Typography>
          {!isSubmitting && (
            <IconButton onClick={onClose} aria-label="Close dialog" sx={{ color: '#546669' }}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {mode === 'create' && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <FormControlLabel
              control={
                <Switch 
                  checked={isInterviewMode} 
                  onChange={(e) => setIsInterviewMode(e.target.checked)} 
                  color="primary"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AutoAwesomeIcon sx={{ fontSize: 18, color: isInterviewMode ? 'primary.main' : 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontWeight: isInterviewMode ? 600 : 400 }}>
                    Interview Mode
                  </Typography>
                </Box>
              }
            />
          </Box>
        )}

        {isInterviewMode ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: 400 }}>
            <Paper sx={{ flex: 1, p: 2, overflowY: 'auto', borderRadius: 3, backgroundColor: '#f6f3ee', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {interviewMessages.map((msg, idx) => (
                <Box key={idx} sx={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                  <Paper elevation={0} sx={{ 
                    p: 2, 
                    borderRadius: 3, 
                    backgroundColor: msg.role === 'user' ? '#16334a' : '#ffffff',
                    color: msg.role === 'user' ? '#ffffff' : '#16334a',
                    borderBottomRightRadius: msg.role === 'user' ? 4 : 12,
                    borderBottomLeftRadius: msg.role === 'system' ? 4 : 12,
                  }}>
                    <Typography variant="body2">{msg.content}</Typography>
                  </Paper>
                </Box>
              ))}
            </Paper>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="E.g., My grandfather, John Doe. He was a baker..."
                value={interviewText}
                onChange={(e) => setInterviewText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInterviewSubmit()}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
              <IconButton 
                onClick={handleInterviewSubmit}
                color="primary" 
                sx={{ backgroundColor: '#16334a', color: 'white', '&:hover': { backgroundColor: '#2e4a62' } }}
              >
                <SendIcon />
              </IconButton>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={avatarPreviewUrl || undefined}
                  onClick={handleAvatarPickClick}
                  sx={{
                    width: 64,
                    height: 64,
                    backgroundColor: '#d0e3e6',
                    color: '#16334a',
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.85 },
                  }}
                >
                  {!avatarPreviewUrl && (getInitials() || <PersonIcon fontSize="large" />)}
                </Avatar>
                <IconButton
                  size="small"
                  onClick={handleAvatarPickClick}
                  aria-label="Upload profile photo"
                  sx={{
                    position: 'absolute',
                    bottom: -4,
                    right: -4,
                    width: 26,
                    height: 26,
                    backgroundColor: '#16334a',
                    color: '#ffffff',
                    border: '2px solid #faf9f7',
                    '&:hover': { backgroundColor: '#2e4a62' },
                  }}
                >
                  <PhotoCameraIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleAvatarFileSelect}
                />
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="First Name *"
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    error={!!errors.firstName && touched.firstName}
                    helperText={touched.firstName ? errors.firstName : ''}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Last Name"
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                  />
                </Grid>
              </Grid>
            </Box>
            {avatarError && (
              <Typography variant="caption" sx={{ color: 'error.main', mt: -2 }}>
                {avatarError}
              </Typography>
            )}

            <FormControl fullWidth>
              <InputLabel>Role / Person Type</InputLabel>
              <Select
                value={formData.personType}
                label="Role / Person Type"
                onChange={(e) => handleChange('personType', e.target.value)}
              >
                {PERSON_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {mode === 'create' && existingPeople && existingPeople.length > 0 && (
              <Box sx={{ p: 2, backgroundColor: '#f6f3ee', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>Quick Relationship (Optional)</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Related To</InputLabel>
                      <Select
                        value={formData.relationshipTo || ''}
                        label="Related To"
                        onChange={(e) => handleChange('relationshipTo', e.target.value)}
                      >
                        <MenuItem value=""><em>None</em></MenuItem>
                        {existingPeople.map((p) => (
                          <MenuItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  {formData.relationshipTo && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Relationship</InputLabel>
                        <Select
                          value={formData.relationshipType || ''}
                          label="Relationship"
                          onChange={(e) => handleChange('relationshipType', e.target.value)}
                        >
                          {RELATIONSHIP_TYPES.map((type) => (
                            <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}

            <Accordion elevation={0} sx={{ backgroundColor: 'transparent', '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0 }}>
                <Typography variant="subtitle2" color="primary">Advanced Options (Dates, Details, Bio)</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth size="small" label="Birth Date" type="date"
                      value={formData.birthDate} onChange={(e) => handleChange('birthDate', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth size="small" label="Death Date" type="date"
                      value={formData.deathDate} onChange={(e) => handleChange('deathDate', e.target.value)}
                      InputLabelProps={{ shrink: true }} error={!!errors.deathDate} helperText={errors.deathDate}
                    />
                  </Grid>
                </Grid>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth size="small" label="Middle Name" value={formData.middleName} onChange={(e) => handleChange('middleName', e.target.value)} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth size="small" label="Nickname" value={formData.nickname} onChange={(e) => handleChange('nickname', e.target.value)} />
                  </Grid>
                </Grid>
                <TextField
                  fullWidth label="Biography" multiline rows={3}
                  value={formData.bio} onChange={(e) => handleChange('bio', e.target.value)}
                />
              </AccordionDetails>
            </Accordion>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 3, backgroundColor: '#f6f3ee', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
        <Button onClick={onClose} disabled={isSubmitting} sx={{ color: '#546669', textTransform: 'none' }}>
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting || isInterviewMode}
          startIcon={isSubmitting ? undefined : <CheckIcon />}
          sx={{ backgroundColor: '#16334a', textTransform: 'none', borderRadius: 2, px: 4, '&:hover': { backgroundColor: '#2e4a62' } }}
        >
          {isSubmitting ? 'Saving...' : mode === 'create' ? 'Add to Family Tree' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
