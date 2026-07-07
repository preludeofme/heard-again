import Head from 'next/head'
import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  Check,
  Computer,
  Cloud,
  Storage,
  Terminal,
  Launch,
  ArrowForward,
  ArrowBack,
  Settings as SettingsIcon,
} from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'

export default function SelfHostingTutorial() {
  const [setupMode, setSetupMode] = useState<'LITE' | 'FULL'>('LITE')
  const [activeStep, setActiveStep] = useState(0)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const handleNext = () => {
    setActiveStep((prev) => prev + 1)
  }

  const handleBack = () => {
    setActiveStep((prev) => prev - 1)
  }

  const handleReset = () => {
    setActiveStep(0)
  }

  const handleModeChange = (mode: 'LITE' | 'FULL') => {
    setSetupMode(mode)
    setActiveStep(0)
  }

  // Define steps dynamically based on selected mode
  const getSteps = () => {
    if (setupMode === 'LITE') {
      return [
        {
          label: 'System Requirements (Lite)',
          icon: <Computer />,
          content: [
            { text: 'Node.js 20.9+ and npm', checked: true },
            { text: 'PostgreSQL 15+ database (local or Docker)', checked: true },
            { text: 'Redis 7+ cache (local or Docker)', checked: true },
            { text: '2GB+ RAM (4GB+ recommended)', checked: true },
            { text: '5GB+ free disk space', checked: true },
            { text: 'Python 3.10+ / CUDA / GPU (Bypassed in Lite Mode)', checked: false },
          ],
        },
        {
          label: 'Clone and Install',
          icon: <Terminal />,
          commands: [
            'git clone https://github.com/preludeofme/heard-again.git',
            'cd heard-again',
            'npm run install:all',
            'cp .env.example .env',
          ],
        },
        {
          label: 'Configure Environment (No-AI)',
          icon: <SettingsIcon />,
          commands: [
            '# Open the root .env file and update/ensure these values:',
            'AUDIO_GENERATION_ENABLED="false"',
            'NARRATION_WORKER_ENABLED="false"',
            'STORAGE_MODE="local"',
            'UPLOAD_DIR="./uploads"',
            '',
            '# Sync variables to the Next.js app directory:',
            'cp .env UI/.env',
          ],
        },
        {
          label: 'Start Database & Caching',
          icon: <Storage />,
          commands: [
            '# Start PostgreSQL, Redis, and ClamAV (for secure file virus scanning)',
            'docker compose up -d db redis clamav',
          ],
        },
        {
          label: 'Database Initialization',
          icon: <Storage />,
          commands: [
            '# Generate the Prisma client types:',
            'npm run db:generate',
            '',
            '# Run database migrations to construct tables:',
            'npm run db:migrate',
            '',
            '# Seed database with initial spaces & default account:',
            'npm run db:seed',
          ],
        },
        {
          label: 'Launch application',
          icon: <Launch />,
          commands: [
            '# Option A: Start Next.js development server only (Lightest mode)',
            'npm --workspace UI run dev',
            '',
            '# Option B: Start Next.js dev server AND background task workers (for imports/exports)',
            '# Note: Make sure to setup TRIGGER_SECRET_KEY in .env first',
            'npm run dev',
            '',
            '# Access the app at http://localhost:4777',
          ],
        },
      ]
    } else {
      return [
        {
          label: 'System Requirements (Full AI)',
          icon: <Computer />,
          content: [
            { text: 'Node.js 20.9+ and npm', checked: true },
            { text: 'PostgreSQL 15+ database', checked: true },
            { text: 'Redis 7+ cache', checked: true },
            { text: 'Python 3.10+ (for Qwen3-TTS engine)', checked: true },
            { text: 'NVIDIA GPU with CUDA 11.8+ (for local voice generation)', checked: false },
            { text: '8GB+ RAM (16GB+ recommended)', checked: true },
            { text: '20GB+ free disk space', checked: true },
          ],
        },
        {
          label: 'Clone and Install',
          icon: <Terminal />,
          commands: [
            'git clone https://github.com/preludeofme/heard-again.git',
            'cd heard-again',
            'npm run install:all',
            'cp .env.example .env',
          ],
        },
        {
          label: 'Database Setup',
          icon: <Storage />,
          commands: [
            '# Update DATABASE_URL and POSTGRES_PASSWORD in your root .env',
            '',
            '# Start full infrastructure (PostgreSQL, Redis, ClamAV)',
            'docker compose up -d db redis clamav',
            '',
            '# Run database migrations and seed',
            'npm run db:generate',
            'npm run db:migrate',
            'npm run db:seed',
          ],
        },
        {
          label: 'Voice Service Setup (Qwen3-TTS)',
          icon: <Computer />,
          commands: [
            '# Set up Python virtual environment for Qwen3-TTS',
            'cd TTS/tts-service',
            'python -m venv venv',
            'source venv/bin/activate  # Windows: venv\\Scripts\\activate',
            'pip install -r requirements.txt',
            '',
            '# Copy voice service environment configuration',
            'cp .env.example .env',
          ],
        },
        {
          label: 'Cloud Tunnel Setup (Optional)',
          icon: <Cloud />,
          content: [
            { text: 'Enable tunnel in familyspace settings', checked: false },
            { text: 'Install cloudflared on your server', checked: false },
            { text: 'Run cloudflared with your tunnel token', checked: false },
            { text: 'Access your instance from anywhere', checked: false },
          ],
        },
        {
          label: 'Launch Full Stack',
          icon: <Launch />,
          commands: [
            '# Start all services (Next.js, TTS FastAPI, Trigger.dev task worker) with live logging',
            './Scripts/start-dev.sh --live',
            '',
            '# Access the app at http://localhost:4777',
          ],
        },
      ]
    }
  }

  const steps = getSteps()

  return (
    <>
      <Head>
        <title>Self-Hosting Guide - Heard Again</title>
      </Head>
      <Layout>
        <Container maxWidth="md" sx={{ py: 6 }}>
          <Typography variant="h4" className="serif-font" sx={{ color: '#16334a', mb: 1, fontWeight: 700 }}>
            Self-Hosting Setup Guide
          </Typography>
          <Typography variant="body1" sx={{ color: '#546669', mb: 4 }}>
            Configure and launch your Heard Again family space server.
          </Typography>

          {/* Mode Selector Option Cards */}
          <Box sx={{ mb: 4, display: 'flex', gap: 2.5, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Card
              onClick={() => handleModeChange('LITE')}
              sx={{
                flex: 1,
                cursor: 'pointer',
                borderRadius: 4,
                border: `2px solid ${setupMode === 'LITE' ? '#16334a' : 'transparent'}`,
                backgroundColor: setupMode === 'LITE' ? '#f5f7f9' : '#fff',
                boxShadow: setupMode === 'LITE' ? '0 8px 24px rgba(22, 51, 74, 0.1)' : '0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 30px rgba(22, 51, 74, 0.12)',
                },
              }}
            >
              {setupMode === 'LITE' && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(90deg, #16334a 0%, #3a6073 100%)',
                  }}
                />
              )}
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 700, fontSize: '1.1rem' }}>
                    Lite (No-AI) Setup
                  </Typography>
                  <Chip
                    label="Highly Recommended"
                    size="small"
                    sx={{
                      bgcolor: '#16334a',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                    }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: '#546669', lineHeight: 1.5 }}>
                  Run core storytelling, file hosting, family trees, timelines, and GEDCOM utilities. Minimal hardware, no Python or GPU required.
                </Typography>
              </CardContent>
            </Card>

            <Card
              onClick={() => handleModeChange('FULL')}
              sx={{
                flex: 1,
                cursor: 'pointer',
                borderRadius: 4,
                border: `2px solid ${setupMode === 'FULL' ? '#16334a' : 'transparent'}`,
                backgroundColor: setupMode === 'FULL' ? '#f5f7f9' : '#fff',
                boxShadow: setupMode === 'FULL' ? '0 8px 24px rgba(22, 51, 74, 0.1)' : '0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 30px rgba(22, 51, 74, 0.12)',
                },
              }}
            >
              {setupMode === 'FULL' && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(90deg, #16334a 0%, #3a6073 100%)',
                  }}
                />
              )}
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 700, fontSize: '1.1rem' }}>
                    Full AI Setup
                  </Typography>
                  <Chip
                    label="GPU Required"
                    variant="outlined"
                    size="small"
                    sx={{
                      borderColor: '#f57c00',
                      color: '#f57c00',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                    }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: '#546669', lineHeight: 1.5 }}>
                  Activate all voice features: voice cloning, text-to-speech narrations, and Whisper-powered audio transcription.
                </Typography>
              </CardContent>
            </Card>
          </Box>

          <Alert severity="info" sx={{ mb: 4, borderRadius: 3 }}>
            You are setting up the <strong>{setupMode === 'LITE' ? 'Lite (No-AI) version' : 'Full AI-powered version'}</strong>. You can switch setup paths above at any time.
          </Alert>

          <Stepper activeStep={activeStep} orientation="vertical">
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel
                  StepIconComponent={() => (
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        bgcolor: activeStep > index ? 'success.main' : activeStep === index ? '#16334a' : 'grey.300',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {activeStep > index ? <Check fontSize="small" /> : step.icon}
                    </Box>
                  )}
                >
                  <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600 }}>
                    {step.label}
                  </Typography>
                </StepLabel>
                <StepContent>
                  <Card variant="outlined" sx={{ mb: 2, borderRadius: 3, border: '1px solid rgba(22,51,74,0.08)' }}>
                    <CardContent sx={{ p: 3 }}>
                      {step.content && (
                        <List dense sx={{ py: 0 }}>
                          {step.content.map((item, i) => (
                            <ListItem key={i} sx={{ px: 0 }}>
                              <ListItemIcon sx={{ minWidth: 90 }}>
                                <Chip
                                  size="small"
                                  label={item.checked ? 'Required' : 'Optional'}
                                  color={item.checked ? 'primary' : 'default'}
                                  variant={item.checked ? 'filled' : 'outlined'}
                                  sx={{
                                    fontSize: '0.7rem',
                                    height: 20,
                                    bgcolor: item.checked ? '#16334a' : 'transparent',
                                  }}
                                />
                              </ListItemIcon>
                              <ListItemText
                                primary={item.text}
                                primaryTypographyProps={{
                                  variant: 'body2',
                                  color: item.text.includes('Bypassed') ? 'text.secondary' : 'text.primary',
                                  sx: {
                                    textDecoration: item.text.includes('Bypassed') ? 'line-through' : 'none',
                                    fontWeight: item.checked ? 500 : 400,
                                  },
                                }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      )}
                      {step.commands && (
                        <Paper
                          sx={{
                            p: 2,
                            bgcolor: '#1c1c19',
                            color: '#fcf9f4',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            overflow: 'auto',
                            borderRadius: 2,
                            boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.2)',
                          }}
                        >
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                            {step.commands.join('\n')}
                          </pre>
                        </Paper>
                      )}
                    </CardContent>
                  </Card>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 1 }}>
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      endIcon={<ArrowForward />}
                      sx={{
                        bgcolor: '#16334a',
                        borderRadius: 2,
                        px: 3,
                        '&:hover': { bgcolor: '#2e4a62' },
                      }}
                    >
                      {index === steps.length - 1 ? 'Finish' : 'Continue'}
                    </Button>
                    <Button
                      disabled={index === 0}
                      onClick={handleBack}
                      startIcon={<ArrowBack />}
                      sx={{
                        borderRadius: 2,
                        color: '#546669',
                      }}
                    >
                      Back
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>

          {activeStep === steps.length && (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 4, mt: 4, boxShadow: '0 8px 30px rgba(0,0,0,0.05)', border: '1px solid rgba(22,51,74,0.05)' }}>
              <Typography variant="h5" sx={{ color: '#2e7d32', mb: 2, fontWeight: 700 }}>
                🎉 Setup Complete!
              </Typography>
              <Typography variant="body1" sx={{ color: '#546669', mb: 3 }}>
                Your Heard Again <strong>{setupMode === 'LITE' ? 'Lite' : 'Full AI'}</strong> instance is configured. Visit <strong>http://localhost:4777</strong> to start preserving your family legacy.
              </Typography>
              <Button
                variant="outlined"
                onClick={handleReset}
                sx={{
                  borderColor: '#16334a',
                  color: '#16334a',
                  borderRadius: 2,
                  '&:hover': { borderColor: '#2e4a62', bgcolor: 'rgba(22, 51, 74, 0.04)' },
                }}
              >
                Restart Guide
              </Button>
              <Divider sx={{ my: 3 }} />
              <Typography variant="body2" sx={{ color: '#6f7c7f' }}>
                Need help? Refer to `README.md` or contact your system administrator.
              </Typography>
            </Paper>
          )}
        </Container>
      </Layout>
    </>
  )
}

export async function getServerSideProps() {
  return { props: {} }
}
