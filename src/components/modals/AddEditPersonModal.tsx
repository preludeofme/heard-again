import React, { useState, useEffect } from 'react'
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
  Stepper,
  Step,
  StepLabel,
  Paper,
} from '@mui/material'
import {
  Close as CloseIcon,
  Person as PersonIcon,
  CloudUpload as UploadIcon,
  ChevronRight as NextIcon,
  ChevronLeft as BackIcon,
  Check as CheckIcon,
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
  // Optional relationship fields for create flow (handled separately)
  relationshipTo?: string
  relationshipType?: 'PARENT' | 'CHILD' | 'SPOUSE'
  relationshipKind?: 'BIOLOGICAL' | 'ADOPTED' | 'STEP'
}

export interface ExistingPerson {
  id: string
  firstName: string
  lastName?: string
}

interface AddEditPersonModalProps {
  open: boolean
  onClose: () => void
  person?: PersonFormData & { id?: string }
  mode: 'create' | 'edit'
  onSubmit: (data: PersonFormData) => Promise<void>
  isSubmitting?: boolean
  // Optional: for relationship creation during add
  existingPeople?: ExistingPerson[]
}

const PERSON_TYPES = [
  { value: PersonType.FAMILY, label: 'Family', description: 'Family member - parents, grandparents, children, siblings' },
  { value: PersonType.FRIEND, label: 'Friend', description: 'Close friend or companion' },
  { value: PersonType.MENTOR, label: 'Mentor', description: 'Teacher, mentor, or guide' },
  { value: PersonType.COLLEAGUE, label: 'Colleague', description: 'Work colleague or professional connection' },
  { value: PersonType.OTHER, label: 'Other', description: 'Caregiver, or other significant person' },
]

const COMMON_ROLES = [
  'Grandparent',
  'Parent',
  'Spouse',
  'Child',
  'Grandchild',
  'Sibling',
  'Aunt/Uncle',
  'Niece/Nephew',
  'Cousin',
  'Friend',
  'Teacher',
  'Mentor',
  'Caregiver',
]

const STEPS_CREATE = ['Basic Info', 'Dates & Details', 'Relationships', 'Review']
const STEPS_EDIT = ['Basic Info', 'Dates & Details', 'Review']

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
  const steps = mode === 'create' && existingPeople?.length ? STEPS_CREATE : STEPS_EDIT
  const [activeStep, setActiveStep] = useState(0)
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

  // Initialize form data when editing
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
    }
    setActiveStep(0)
    setErrors({})
    setTouched({})
  }, [person, mode, open])

  const handleChange = (field: keyof PersonFormData, value: string | boolean) => {
    // Auto-set isDeceased when death date is provided
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
    // Clear error when field is modified
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof PersonFormData, string>> = {}

    if (step === 0) {
      if (!formData.firstName.trim()) {
        newErrors.firstName = 'First name is required'
      }
    }

    if (step === 1) {
      // Validate dates if provided
      if (formData.birthDate && formData.deathDate) {
        const birth = new Date(formData.birthDate)
        const death = new Date(formData.deathDate)
        if (death < birth) {
          newErrors.deathDate = 'Death date cannot be before birth date'
        }
      }
    }

    // Validate relationships step if applicable
    if (step === 2 && mode === 'create' && existingPeople?.length) {
      if (formData.relationshipTo && !formData.relationshipType) {
        newErrors.relationshipType = 'Please select a relationship type'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    setActiveStep((prev) => prev - 1)
  }

  const handleSubmit = async () => {
    if (validateStep(activeStep)) {
      try {
        await onSubmit(formData)
        // Modal will be closed by the parent component on success
      } catch (error) {
        console.error('Failed to save person:', error)
        // Show error to user - you could add a toast/snackbar here
        alert(`Error: ${error instanceof Error ? error.message : 'Failed to save person'}`)
      }
    }
  }

  const getFullName = () => {
    const name = `${formData.firstName} ${formData.lastName}`.trim()
    return name || 'Unnamed Person'
  }

  const getInitials = () => {
    return `${formData.firstName[0] || ''}${formData.lastName[0] || ''}`.toUpperCase()
  }

  // Step 1: Basic Info
  const renderBasicInfo = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Avatar Upload Placeholder */}
      <Paper
        variant="outlined"
        sx={{
          p: 4,
          borderRadius: 3,
          borderStyle: 'dashed',
          borderColor: '#d0e3e6',
          backgroundColor: 'rgba(208, 227, 230, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          cursor: 'pointer',
          transition: 'all 0.2s',
          '&:hover': {
            backgroundColor: 'rgba(208, 227, 230, 0.2)',
            borderColor: '#16334a',
          },
        }}
      >
        <Avatar
          sx={{
            width: 80,
            height: 80,
            backgroundColor: '#d0e3e6',
            fontSize: '2rem',
          }}
        >
          {getInitials() || <PersonIcon sx={{ fontSize: 40, color: '#16334a' }} />}
        </Avatar>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: '#16334a', fontWeight: 500, mb: 0.5 }}>
            Add a photo
          </Typography>
          <Typography variant="caption" sx={{ color: '#666' }}>
            Click to upload or drag and drop
          </Typography>
        </Box>
      </Paper>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="First Name *"
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            error={!!errors.firstName && touched.firstName}
            helperText={touched.firstName ? errors.firstName : ''}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Last Name"
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
        </Grid>
      </Grid>

      <TextField
        fullWidth
        label="Display Name (Optional)"
        value={formData.displayName}
        onChange={(e) => handleChange('displayName', e.target.value)}
        placeholder="e.g., Grandma Eleanor, Uncle Bob"
        helperText="How you commonly refer to this person"
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
          },
        }}
      />

      <FormControl fullWidth>
        <InputLabel>Person Type</InputLabel>
        <Select
          value={formData.personType}
          label="Person Type"
          onChange={(e) => handleChange('personType', e.target.value)}
          sx={{
            borderRadius: 2,
          }}
        >
          {PERSON_TYPES.map((type) => (
            <MenuItem key={type.value} value={type.value}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {type.label}
                </Typography>
                <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                  {type.description}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  )

  // Step 2: Dates & Details
  const renderDatesDetails = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Birth Date"
            type="date"
            value={formData.birthDate}
            onChange={(e) => handleChange('birthDate', e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Death Date (if applicable)"
            type="date"
            value={formData.deathDate}
            onChange={(e) => handleChange('deathDate', e.target.value)}
            error={!!errors.deathDate}
            helperText={errors.deathDate}
            InputLabelProps={{ shrink: true }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Middle Name"
            value={formData.middleName}
            onChange={(e) => handleChange('middleName', e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Nickname"
            value={formData.nickname}
            onChange={(e) => handleChange('nickname', e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Maiden Name"
            value={formData.maidenName}
            onChange={(e) => handleChange('maidenName', e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Suffix"
            value={formData.suffix}
            onChange={(e) => handleChange('suffix', e.target.value)}
            placeholder="e.g., Jr, Sr, III"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
        </Grid>
      </Grid>

      <TextField
        fullWidth
        label="Biography"
        multiline
        rows={4}
        value={formData.bio}
        onChange={(e) => handleChange('bio', e.target.value)}
        placeholder="Share a brief biography, key memories, or what made this person special..."
        helperText={`${formData.bio?.length || 0}/5000 characters`}
        inputProps={{ maxLength: 5000 }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
          },
        }}
      />
    </Box>
  )

  // Step 3: Review
  const renderReview = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper sx={{ p: 4, borderRadius: 3, backgroundColor: '#f6f3ee' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
          <Avatar
            sx={{
              width: 64,
              height: 64,
              backgroundColor: '#d0e3e6',
              fontSize: '1.5rem',
            }}
          >
            {getInitials()}
          </Avatar>
          <Box>
            <Typography variant="h5" sx={{ color: '#16334a', fontWeight: 600, fontFamily: 'var(--font-newsreader), serif' }}>
              {getFullName()}
            </Typography>
            {formData.displayName && (
              <Typography variant="body2" sx={{ color: '#666' }}>
                Known as: {formData.displayName}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              <Chip
                label={formData.personType.toLowerCase().replace('_', ' ')}
                size="small"
                sx={{
                  backgroundColor: '#16334a',
                  color: 'white',
                  textTransform: 'capitalize',
                  fontSize: '0.7rem',
                }}
              />
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={2}>
          {formData.birthDate && (
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                Birth Date
              </Typography>
              <Typography variant="body2" sx={{ color: '#16334a', fontWeight: 500 }}>
                {new Date(formData.birthDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </Typography>
            </Grid>
          )}
          {formData.deathDate && (
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                Death Date
              </Typography>
              <Typography variant="body2" sx={{ color: '#16334a', fontWeight: 500 }}>
                {new Date(formData.deathDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </Typography>
            </Grid>
          )}
        </Grid>

        {formData.bio && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
              Biography
            </Typography>
            <Typography variant="body2" sx={{ color: '#546669', fontStyle: 'italic', lineHeight: 1.6 }}>
              &ldquo;{formData.bio}&rdquo;
            </Typography>
          </>
        )}
      </Paper>

      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: '#666' }}>
          Review the information above. Click &ldquo;{mode === 'create' ? 'Create' : 'Save'} Person&rdquo; to {mode === 'create' ? 'add' : 'update'} this person to your family tree.
        </Typography>
      </Box>
    </Box>
  )

  // Step 3: Relationships (only shown in create mode with existing people)
  const renderRelationships = () => {
    const selectedPerson = existingPeople?.find((p) => p.id === formData.relationshipTo)

    return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="subtitle1" sx={{ color: '#16334a', fontWeight: 600 }}>
        Link to Existing Person (Optional)
      </Typography>
      <Typography variant="body2" sx={{ color: '#666' }}>
        Define how this new person relates to someone already in your family tree.
      </Typography>

      <FormControl fullWidth>
        <InputLabel>Existing Person</InputLabel>
        <Select
          value={formData.relationshipTo || ''}
          label="Existing Person"
          onChange={(e) => handleChange('relationshipTo', e.target.value)}
          sx={{ borderRadius: 2 }}
        >
          <MenuItem value="">
            <em>None - standalone entry</em>
          </MenuItem>
          {existingPeople?.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {formData.relationshipTo && (
        <>
          <FormControl fullWidth>
            <InputLabel>Relationship Type *</InputLabel>
            <Select
              value={formData.relationshipType || ''}
              label="Relationship Type *"
              onChange={(e) => handleChange('relationshipType', e.target.value)}
              error={!!errors.relationshipType}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="">
                <em>Select relationship...</em>
              </MenuItem>
              {RELATIONSHIP_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
            {errors.relationshipType && (
              <FormHelperText error>{errors.relationshipType}</FormHelperText>
            )}
          </FormControl>

          {(formData.relationshipType === 'PARENT' || formData.relationshipType === 'CHILD') && (
            <FormControl fullWidth>
              <InputLabel>Relationship Kind</InputLabel>
              <Select
                value={formData.relationshipKind || 'BIOLOGICAL'}
                label="Relationship Kind"
                onChange={(e) => handleChange('relationshipKind', e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                {RELATIONSHIP_KINDS.map((kind) => (
                  <MenuItem key={kind.value} value={kind.value}>
                    {kind.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </>
      )}

      {/* Relationship description preview */}
      {selectedPerson && formData.relationshipType ? (
        <Box sx={{ mt: 2, p: 2, backgroundColor: '#e8f4e8', borderRadius: 2, border: '1px solid #c3e6c3' }}>
          <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 500 }}>
            {(() => {
              const newName = formData.firstName ? `${formData.firstName}${formData.lastName ? ` ${formData.lastName}` : ''}` : 'This new person'
              const targetName = `${selectedPerson.firstName}${selectedPerson.lastName ? ` ${selectedPerson.lastName}` : ''}`
              if (formData.relationshipType === 'PARENT') return `${newName} is a parent of ${targetName}`
              if (formData.relationshipType === 'CHILD') return `${newName} is a child of ${targetName}`
              if (formData.relationshipType === 'SPOUSE') return `${newName} is spouse/partner of ${targetName}`
              return ''
            })()}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ mt: 2, p: 2, backgroundColor: '#f6f3ee', borderRadius: 2 }}>
          <Typography variant="caption" sx={{ color: '#666' }}>
            {selectedPerson
              ? `Choose a relationship type to see a preview of what will be created.`
              : 'Choose a person first, then set the exact relationship direction.'}
          </Typography>
        </Box>
      )}
    </Box>
    )
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderBasicInfo()
      case 1:
        return renderDatesDetails()
      case 2:
        // Show relationships step only in create mode with existing people
        if (mode === 'create' && existingPeople?.length) {
          return renderRelationships()
        }
        return renderReview()
      case 3:
        return renderReview()
      default:
        return null
    }
  }

  return (
    <Dialog
      open={open}
      onClose={!isSubmitting ? onClose : undefined}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5" sx={{ color: '#16334a', fontWeight: 600, fontFamily: 'var(--font-newsreader), serif' }}>
            {mode === 'create' ? 'Add New Person' : 'Edit Person'}
          </Typography>
          {!isSubmitting && (
            <IconButton onClick={onClose} sx={{ color: '#546669' }}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label: string) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {renderStepContent()}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 3, backgroundColor: '#f6f3ee' }}>
        <Button
          onClick={handleBack}
          disabled={activeStep === 0 || isSubmitting}
          startIcon={<BackIcon />}
          sx={{
            color: '#546669',
            textTransform: 'none',
            visibility: activeStep === 0 ? 'hidden' : 'visible',
          }}
        >
          Back
        </Button>
        <Box sx={{ flex: 1 }} />
        {activeStep === steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmitting}
            startIcon={isSubmitting ? undefined : <CheckIcon />}
            sx={{
              backgroundColor: '#16334a',
              textTransform: 'none',
              borderRadius: 2,
              px: 4,
              '&:hover': { backgroundColor: '#2e4a62' },
            }}
          >
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Person' : 'Save Changes'}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            endIcon={<NextIcon />}
            sx={{
              backgroundColor: '#16334a',
              textTransform: 'none',
              borderRadius: 2,
              px: 4,
              '&:hover': { backgroundColor: '#2e4a62' },
            }}
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
