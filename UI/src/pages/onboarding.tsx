import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import {
  Box,
  Typography,
  Button,
  Container,
  Card,
  TextField,
  Stepper,
  Step,
  StepLabel,
  useTheme,
  Alert,
  CircularProgress,
  Fade,
} from '@mui/material'
import { FamilyRestroom, PersonAdd, Celebration } from '@mui/icons-material'

const steps = ['Family Name', 'Your Profile', 'Get Started']

export default function OnboardingPage() {
  const theme = useTheme()
  const router = useRouter()
  const { data: session, update } = useSession()
  const [activeStep, setActiveStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    familyName: '',
    firstName: '',
    lastName: '',
  })
  const [ahaName, setAhaName] = useState('')
  const [ahaMemory, setAhaMemory] = useState('')
  const [isAhaGenerated, setIsAhaGenerated] = useState(false)

  const handleNext = async () => {
    if (activeStep === 0) {
      // Validate family name
      if (!formData.familyName.trim()) {
        setError('Every story needs a name. What should we call yours?')
        return
      }
      setError(null)
      setActiveStep(1)
    } else if (activeStep === 1) {
      // Validate name
      if (!formData.firstName.trim()) {
        setError('Please enter your first name')
        return
      }
      setError(null)
      setActiveStep(2)
    } else if (activeStep === 2) {
      // Complete onboarding
      await completeOnboarding()
    }
  }

  const handleBack = () => {
    setError(null)
    setActiveStep((prev) => prev - 1)
  }

  const completeOnboarding = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/complete-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          familyName: formData.familyName,
          firstName: formData.firstName,
          lastName: formData.lastName,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete onboarding')
      }

      // Update session to reflect onboarding is complete
      await update()

      // Redirect to dashboard (middleware will allow access since onboarding is now complete)
      router.push('/archive')
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Fade in>
            <Box>
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: 'rgba(208, 227, 230, 0.3)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 3,
                  }}
                >
                  <FamilyRestroom sx={{ fontSize: 40, color: 'primary.main' }} />
                </Box>
                <Typography
                  variant="h4"
                  sx={{
                    color: 'primary.main',
                    mb: 2,
                    fontFamily: 'var(--font-newsreader), serif',
                  }}
                >
                  What should we call your family story?
                </Typography>
                <Typography variant="body1" sx={{ color: 'secondary.main' }}>
                  This will be the name of your family familyspace. You can always change it later.
                </Typography>
              </Box>

              <TextField
                fullWidth
                label="Family Name"
                placeholder="e.g., The Johnson Family, Smith Legacy, etc."
                value={formData.familyName}
                onChange={(e) =>
                  setFormData({ ...formData, familyName: e.target.value })
                }
                sx={{ mb: 2 }}
                required
              />
              <Typography variant="caption" sx={{ color: 'secondary.main' }}>
                This name will appear on your family tree and story.
              </Typography>
            </Box>
          </Fade>
        )

      case 1:
        return (
          <Fade in>
            <Box>
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: 'rgba(208, 227, 230, 0.3)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 3,
                  }}
                >
                  <PersonAdd sx={{ fontSize: 40, color: 'primary.main' }} />
                </Box>
                <Typography
                  variant="h4"
                  sx={{
                    color: 'primary.main',
                    mb: 2,
                    fontFamily: 'var(--font-newsreader), serif',
                  }}
                >
                  Tell us about yourself
                </Typography>
                <Typography variant="body1" sx={{ color: 'secondary.main' }}>
                  You&apos;ll be the first member of your family tree. Others can be added later.
                </Typography>
              </Box>

              <TextField
                fullWidth
                label="First Name"
                placeholder="Your first name"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                sx={{ mb: 3 }}
                required
              />

              <TextField
                fullWidth
                label="Last Name (Optional)"
                placeholder="Your last name"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
              />
            </Box>
          </Fade>
        )

      case 2:
        return (
          <Fade in>
            <Box sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'rgba(208, 227, 230, 0.3)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3,
                }}
              >
                <Celebration sx={{ fontSize: 40, color: 'primary.main' }} />
              </Box>
              <Typography
                variant="h4"
                sx={{
                  color: 'primary.main',
                  mb: 2,
                  fontFamily: 'var(--font-newsreader), serif',
                }}
              >
                You're all set! Let's make some magic.
              </Typography>
              <Typography variant="body1" sx={{ color: 'secondary.main', mb: 4 }}>
                Welcome to <strong>{formData.familyName}</strong>. Who are you preserving memories for today?
              </Typography>

              {!isAhaGenerated ? (
                <Box sx={{ textAlign: 'left' }}>
                  <TextField
                    fullWidth label="Their Name (e.g., Grandpa Joe)"
                    value={ahaName} onChange={e => setAhaName(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth label="Share one brief memory about them..." multiline rows={2}
                    value={ahaMemory} onChange={e => setAhaMemory(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <Button 
                    variant="contained" 
                    fullWidth 
                    disabled={!ahaName || !ahaMemory}
                    onClick={() => {
                      setIsAhaGenerated(true);
                      const utterance = new SpeechSynthesisUtterance(ahaMemory);
                      // Try to pick a decent voice if available
                      const voices = window.speechSynthesis.getVoices();
                      const goodVoice = voices.find(v => v.lang.includes('en') && v.name.includes('Google'));
                      if (goodVoice) utterance.voice = goodVoice;
                      window.speechSynthesis.speak(utterance);
                    }}
                    sx={{ backgroundColor: '#16334a', py: 1.5, '&:hover': { backgroundColor: '#2e4a62' } }}
                  >
                    Generate Magic
                  </Button>
                </Box>
              ) : (
                <Fade in>
                  <Box>
                    <Card sx={{ p: 3, mb: 3, backgroundColor: '#f6f3ee', textAlign: 'left', border: '1px solid #d0e3e6', borderRadius: 3 }}>
                      <Typography variant="caption" sx={{ color: '#16334a', fontWeight: 600 }}>Memory of {ahaName}</Typography>
                      <Typography variant="body1" sx={{ mt: 1, fontStyle: 'italic', color: '#546669' }}>"{ahaMemory}"</Typography>
                      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={16} sx={{ color: '#adcae6' }} />
                        <Typography variant="caption" sx={{ color: '#8a9a9d' }}>Simulating Voice Synthesis for {ahaName}...</Typography>
                      </Box>
                    </Card>
                    <Typography variant="body2" sx={{ color: 'secondary.main', mb: 3 }}>
                      This is just a glimpse of what's possible. Let's head to your dashboard to start building their legacy.
                    </Typography>
                  </Box>
                </Fade>
              )}
            </Box>
          </Fade>
        )

      default:
        return null
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      {/* Header */}
      <Box
        component="header"
        sx={{
          py: 3,
          px: { xs: 3, md: 6 },
          textAlign: 'center',
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontFamily: 'var(--font-newsreader), serif',
            fontStyle: 'italic',
            color: 'primary.main',
          }}
        >
          Heard Again
        </Typography>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 3, md: 6 },
          py: { xs: 4, md: 6 },
        }}
      >
        <Container maxWidth="sm">
          <Card
            sx={{
              bgcolor: 'background.paper',
              p: { xs: 4, md: 6 },
              borderRadius: 6,
              boxShadow: '0 10px 40px rgba(28, 28, 25, 0.06)',
            }}
          >
            {/* Stepper */}
            <Stepper activeStep={activeStep} sx={{ mb: 6 }}>
              {steps.map((label) => (
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

            {/* Step Content */}
            <Box sx={{ mb: 4 }}>{renderStepContent()}</Box>

            {/* Navigation Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button
                onClick={handleBack}
                disabled={activeStep === 0 || isLoading}
                sx={{ visibility: activeStep === 0 ? 'hidden' : 'visible' }}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={isLoading}
                sx={{
                  py: 1.5,
                  px: 4,
                  fontSize: '1rem',
                  fontWeight: 700,
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
                }}
              >
                {isLoading ? (
                  <CircularProgress size={24} sx={{ color: 'white' }} />
                ) : activeStep === steps.length - 1 ? (
                  'Start Your Story'
                ) : (
                  'Continue'
                )}
              </Button>
            </Box>
          </Card>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 3,
          textAlign: 'center',
        }}
      >
        <Typography variant="caption" sx={{ color: 'secondary.main' }}>
          Step {activeStep + 1} of {steps.length}
        </Typography>
      </Box>
    </Box>
  )
}
