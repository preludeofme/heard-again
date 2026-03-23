import { useState } from 'react'
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, MenuItem, FormControlLabel, Checkbox,
  Stepper, Step, StepLabel, CircularProgress, Alert,
} from '@mui/material'
import {
  Close, Add, Person, ArrowBack, ArrowForward, Check,
} from '@mui/icons-material'

interface AddPersonModalProps {
  open: boolean
  onClose: () => void
  onSave: (person: CreatePersonData) => void
  existingPeople?: Array<{ id: string; firstName: string; lastName?: string }>
}

export interface CreatePersonData {
  firstName: string
  lastName?: string
  middleName?: string
  nickname?: string
  maidenName?: string
  suffix?: string
  personType: string
  birthDate?: string
  deathDate?: string
  isDeceased: boolean
  bio?: string
  relationshipTo?: string
  relationshipType?: string
}

const PERSON_TYPES = [
  { value: 'LIVING', label: 'Living Family Member' },
  { value: 'DECEASED', label: 'Deceased Family Member' },
  { value: 'ANCESTOR', label: 'Ancestor' },
  { value: 'DESCENDANT', label: 'Descendant' },
  { value: 'OTHER', label: 'Other' },
]

const RELATIONSHIP_TYPES = [
  { value: 'PARENT', label: 'Parent' },
  { value: 'CHILD', label: 'Child' },
  { value: 'SPOUSE', label: 'Spouse/Partner' },
]

const STEPS = ['Basic Info', 'Life Dates', 'Biography', 'Relationships']

export function AddPersonModal({ open, onClose, onSave, existingPeople = [] }: AddPersonModalProps) {
  const [activeStep, setActiveStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<CreatePersonData>({
    firstName: '',
    lastName: '',
    middleName: '',
    nickname: '',
    maidenName: '',
    suffix: '',
    personType: 'LIVING',
    birthDate: '',
    deathDate: '',
    isDeceased: false,
    bio: '',
    relationshipTo: '',
    relationshipType: '',
  })

  const handleChange = (field: keyof CreatePersonData, value: any) => {
    setFormData((prev) => {
      if (field === 'relationshipTo' && !value) {
        return { ...prev, relationshipTo: '', relationshipType: '' }
      }
      return { ...prev, [field]: value }
    })
    setError(null)
  }

  const validateStep = () => {
    switch (activeStep) {
      case 0:
        if (!formData.firstName.trim()) {
          setError('First name is required')
          return false
        }
        return true
      case 1:
        if (formData.birthDate && formData.deathDate) {
          if (new Date(formData.birthDate) > new Date(formData.deathDate)) {
            setError('Death date must be after birth date')
            return false
          }
        }
        return true
      case 3:
        if (formData.relationshipTo && !formData.relationshipType) {
          setError('Please choose a relationship type when linking to an existing person')
          return false
        }
        return true
      default:
        return true
    }
  }

  const handleNext = () => {
    if (validateStep()) {
      setActiveStep(prev => Math.min(prev + 1, STEPS.length - 1))
    }
  }

  const handleBack = () => {
    setActiveStep(prev => Math.max(prev - 1, 0))
    setError(null)
  }

  const handleSubmit = async () => {
    if (!validateStep()) return
    setIsSubmitting(true)
    try {
      onSave(formData)
      handleClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (isSubmitting) return
    setActiveStep(0)
    setFormData({
      firstName: '',
      lastName: '',
      middleName: '',
      nickname: '',
      maidenName: '',
      suffix: '',
      personType: 'LIVING',
      birthDate: '',
      deathDate: '',
      isDeceased: false,
      bio: '',
      relationshipTo: '',
      relationshipType: '',
    })
    setError(null)
    onClose()
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                label="First Name"
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                autoFocus
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
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Middle Name"
                value={formData.middleName}
                onChange={(e) => handleChange('middleName', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Nickname"
                value={formData.nickname}
                onChange={(e) => handleChange('nickname', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Maiden Name"
                value={formData.maidenName}
                onChange={(e) => handleChange('maidenName', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Suffix (e.g., Jr., Sr., III)"
                value={formData.suffix}
                onChange={(e) => handleChange('suffix', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                select
                fullWidth
                label="Person Type"
                value={formData.personType}
                onChange={(e) => handleChange('personType', e.target.value)}
              >
                {PERSON_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        )

      case 1:
        return (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isDeceased}
                    onChange={(e) => handleChange('isDeceased', e.target.checked)}
                  />
                }
                label="This person is deceased"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="date"
                label="Birth Date"
                value={formData.birthDate}
                onChange={(e) => handleChange('birthDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="date"
                label="Death Date"
                value={formData.deathDate}
                onChange={(e) => handleChange('deathDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
                disabled={!formData.isDeceased}
              />
            </Grid>
          </Grid>
        )

      case 2:
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Write a brief biography or description of this person.
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              label="Biography"
              value={formData.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              placeholder="Share their story, personality, achievements, or any memorable details..."
            />
          </Box>
        )

      case 3:
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Optionally add a relationship to an existing family member.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Supported relationship types: Parent, Child, and Spouse/Partner.
            </Typography>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  select
                  fullWidth
                  label="Related To"
                  value={formData.relationshipTo}
                  onChange={(e) => handleChange('relationshipTo', e.target.value)}
                  disabled={existingPeople.length === 0}
                >
                  <MenuItem value="">None</MenuItem>
                  {existingPeople.map((person) => (
                    <MenuItem key={person.id} value={person.id}>
                      {person.firstName} {person.lastName || ''}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              {formData.relationshipTo && (
                <Grid size={{ xs: 12 }}>
                  <TextField
                    select
                    fullWidth
                    label="Relationship Type"
                    value={formData.relationshipType}
                    onChange={(e) => handleChange('relationshipType', e.target.value)}
                  >
                    {RELATIONSHIP_TYPES.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              )}
            </Grid>
          </Box>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, pt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              backgroundColor: '#d0e3e6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Person sx={{ color: '#16334a' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#16334a' }}>
              Add Family Member
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Step {activeStep + 1} of {STEPS.length}
            </Typography>
          </Box>
        </Box>
        <Button onClick={handleClose} disabled={isSubmitting} size="small">
          <Close />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {renderStepContent()}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 3, justifyContent: 'space-between' }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={handleBack}
          disabled={activeStep === 0 || isSubmitting}
          sx={{ textTransform: 'none' }}
        >
          Back
        </Button>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            onClick={handleClose}
            disabled={isSubmitting}
            sx={{ textTransform: 'none', color: '#666' }}
          >
            Cancel
          </Button>
          {activeStep === STEPS.length - 1 ? (
            <Button
              variant="contained"
              startIcon={isSubmitting ? <CircularProgress size={20} /> : <Check />}
              onClick={handleSubmit}
              disabled={isSubmitting}
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              {isSubmitting ? 'Creating...' : 'Create Person'}
            </Button>
          ) : (
            <Button
              variant="contained"
              endIcon={<ArrowForward />}
              onClick={handleNext}
              disabled={isSubmitting}
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              Next
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  )
}
