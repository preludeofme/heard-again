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

export interface PersonFormData {
  firstName: string
  lastName: string
  displayName?: string
  birthDate?: string
  deathDate?: string
  bio?: string
  personType: 'PRIMARY' | 'ANCESTOR' | 'DESCENDANT' | 'RELATED'
  role?: string
  avatarUrl?: string
}

interface AddEditPersonModalProps {
  open: boolean
  onClose: () => void
  person?: PersonFormData & { id?: string }
  mode: 'create' | 'edit'
  onSubmit: (data: PersonFormData) => Promise<void>
  isSubmitting?: boolean
}

const PERSON_TYPES = [
  { value: 'PRIMARY', label: 'Primary Subject', description: 'The main person this archive is about' },
  { value: 'ANCESTOR', label: 'Ancestor', description: 'Parents, grandparents, or older relatives' },
  { value: 'DESCENDANT', label: 'Descendant', description: 'Children, grandchildren, or younger relatives' },
  { value: 'RELATED', label: 'Related', description: 'Spouses, siblings, cousins, or friends' },
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

const STEPS = ['Basic Info', 'Dates & Details', 'Review']

export function AddEditPersonModal({
  open,
  onClose,
  person,
  mode,
  onSubmit,
  isSubmitting = false,
}: AddEditPersonModalProps) {
  const [activeStep, setActiveStep] = useState(0)
  const [formData, setFormData] = useState<PersonFormData>({
    firstName: '',
    lastName: '',
    displayName: '',
    birthDate: '',
    deathDate: '',
    bio: '',
    personType: 'ANCESTOR',
    role: '',
    avatarUrl: '',
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
        birthDate: person.birthDate || '',
        deathDate: person.deathDate || '',
        bio: person.bio || '',
        personType: person.personType || 'ANCESTOR',
        role: person.role || '',
        avatarUrl: person.avatarUrl || '',
      })
    } else {
      setFormData({
        firstName: '',
        lastName: '',
        displayName: '',
        birthDate: '',
        deathDate: '',
        bio: '',
        personType: 'ANCESTOR',
        role: '',
        avatarUrl: '',
      })
    }
    setActiveStep(0)
    setErrors({})
    setTouched({})
  }, [person, mode, open])

  const handleChange = (field: keyof PersonFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
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
      await onSubmit(formData)
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

      <Box>
        <Typography variant="subtitle2" sx={{ color: '#16334a', mb: 1, fontWeight: 500 }}>
          Role / Relationship
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {COMMON_ROLES.map((role) => (
            <Chip
              key={role}
              label={role}
              onClick={() => handleChange('role', role)}
              sx={{
                backgroundColor: formData.role === role ? '#16334a' : '#f6f3ee',
                color: formData.role === role ? 'white' : '#546669',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: formData.role === role ? '#2e4a62' : '#e8e3dc',
                },
              }}
            />
          ))}
        </Box>
        <TextField
          fullWidth
          placeholder="Or enter a custom role..."
          value={formData.role}
          onChange={(e) => handleChange('role', e.target.value)}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            },
          }}
        />
      </Box>

      <TextField
        fullWidth
        label="Biography"
        multiline
        rows={4}
        value={formData.bio}
        onChange={(e) => handleChange('bio', e.target.value)}
        placeholder="Share a brief biography, key memories, or what made this person special..."
        helperText={`${formData.bio?.length || 0}/500 characters`}
        inputProps={{ maxLength: 500 }}
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
              {formData.role && (
                <Chip
                  label={formData.role}
                  size="small"
                  sx={{
                    backgroundColor: '#d0e3e6',
                    color: '#16334a',
                    fontSize: '0.7rem',
                  }}
                />
              )}
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

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderBasicInfo()
      case 1:
        return renderDatesDetails()
      case 2:
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
          {STEPS.map((label) => (
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
        {activeStep === STEPS.length - 1 ? (
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
