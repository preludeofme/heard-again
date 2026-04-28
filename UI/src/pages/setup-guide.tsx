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
} from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'

const steps = [
  {
    label: 'System Requirements',
    icon: <Computer />,
    content: [
      { text: 'Node.js 18+ and npm/yarn', checked: true },
      { text: 'PostgreSQL 14+ database', checked: true },
      { text: 'Python 3.10+ (for voice features)', checked: true },
      { text: 'NVIDIA GPU with CUDA 11.8+ (optional, for local voice generation)', checked: false },
      { text: '4GB+ RAM (8GB+ recommended)', checked: true },
      { text: '20GB+ free disk space', checked: true },
    ],
  },
  {
    label: 'Clone and Install',
    icon: <Terminal />,
    commands: [
      'git clone https://github.com/heard-again/heard-again.git',
      'cd heard-again',
      'npm install',
      'cp .env.example .env',
    ],
  },
  {
    label: 'Database Setup',
    icon: <Storage />,
    commands: [
      '# Create PostgreSQL database',
      'createdb heard_again',
      '',
      '# Update .env with your database URL',
      'DATABASE_URL="postgresql://user:pass@localhost:5432/heard_again"',
      '',
      '# Run migrations',
      'npx prisma migrate dev',
      'npx prisma db seed',
    ],
  },
  {
    label: 'Voice Service Setup (Optional)',
    icon: <Computer />,
    commands: [
      '# Setup Python environment',
      'cd tts-service',
      'python -m venv venv',
      'source venv/bin/activate  # Windows: venv\\Scripts\\activate',
      'pip install -r requirements.txt',
      '',
      '# Download voice models (automatic on first run)',
      '# Or manually download from HuggingFace',
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
    label: 'Launch',
    icon: <Launch />,
    commands: [
      '# Start the Next.js app',
      'npm run dev',
      '',
      '# Or start voice service separately',
      'npm run start:tts',
      '',
      '# Access at http://localhost:4777',
    ],
  },
]

export default function SelfHostingTutorial() {
  const [activeStep, setActiveStep] = useState(0)

  const handleNext = () => {
    setActiveStep((prev) => prev + 1)
  }

  const handleBack = () => {
    setActiveStep((prev) => prev - 1)
  }

  const handleReset = () => {
    setActiveStep(0)
  }

  return (
    <>
      <Head>
        <title>Self-Hosting Guide - Heard Again</title>
      </Head>
      <Layout>
        <Container maxWidth="md" sx={{ py: 6 }}>
          <Typography variant="h4" className="serif-font" sx={{ color: '#16334a', mb: 2 }}>
            Self-Hosting Setup Guide
          </Typography>
          <Typography variant="body1" sx={{ color: '#546669', mb: 4 }}>
            Follow these steps to set up Heard Again on your own server.
          </Typography>

          <Alert severity="info" sx={{ mb: 4 }}>
            This guide assumes you have basic knowledge of command line, Node.js, and PostgreSQL.
          </Alert>

          <Stepper activeStep={activeStep} orientation="vertical">
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel
                  StepIconComponent={() => (
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: activeStep > index ? 'success.main' : 'primary.main',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {activeStep > index ? <Check fontSize="small" /> : step.icon}
                    </Box>
                  )}
                >
                  <Typography variant="h6" sx={{ color: '#16334a' }}>
                    {step.label}
                  </Typography>
                </StepLabel>
                <StepContent>
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      {step.content && (
                        <List dense>
                          {step.content.map((item, i) => (
                            <ListItem key={i}>
                              <ListItemIcon sx={{ minWidth: 32 }}>
                                <Chip
                                  size="small"
                                  label={item.checked ? 'Required' : 'Optional'}
                                  color={item.checked ? 'primary' : 'default'}
                                  variant={item.checked ? 'filled' : 'outlined'}
                                />
                              </ListItemIcon>
                              <ListItemText primary={item.text} />
                            </ListItem>
                          ))}
                        </List>
                      )}
                      {step.commands && (
                        <Paper
                          sx={{
                            p: 2,
                            bgcolor: '#1e1e1e',
                            color: '#d4d4d4',
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                            overflow: 'auto',
                          }}
                        >
                          <pre style={{ margin: 0 }}>
                            {step.commands.join('\n')}
                          </pre>
                        </Paper>
                      )}
                    </CardContent>
                  </Card>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      endIcon={<ArrowForward />}
                    >
                      {index === steps.length - 1 ? 'Finish' : 'Continue'}
                    </Button>
                    <Button
                      disabled={index === 0}
                      onClick={handleBack}
                      startIcon={<ArrowBack />}
                    >
                      Back
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>

          {activeStep === steps.length && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h5" sx={{ color: '#2e7d32', mb: 2 }}>
                🎉 Setup Complete!
              </Typography>
              <Typography variant="body1" sx={{ color: '#546669', mb: 3 }}>
                Your Heard Again instance is now ready. Visit http://localhost:4777 to start preserving your family stories.
              </Typography>
              <Button variant="outlined" onClick={handleReset}>
                Restart Tutorial
              </Button>
              <Divider sx={{ my: 3 }} />
              <Typography variant="body2" sx={{ color: '#6f7c7f' }}>
                Need help? Join our community Discord or check the documentation.
              </Typography>
            </Paper>
          )}
        </Container>
      </Layout>
    </>
  )
}
