import Head from 'next/head'
import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material'
import {
  Check,
  Cloud,
  ContentCopy,
  Computer,
  ArrowForward,
  ArrowBack,
  Refresh,
} from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'

interface TunnelStatus {
  enabled: boolean
  subdomain: string | null
  publicUrl: string | null
  tokenExpired: boolean
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'unknown'
}

export default function TunnelSetup() {
  const [activeStep, setActiveStep] = useState(0)
  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadTunnelStatus()
  }, [])

  const loadTunnelStatus = async () => {
    try {
      const response = await fetch('/api/instance/status')
      const data = await response.json()

      if (data.success && data.data.tunnel) {
        setTunnelStatus(data.data.tunnel)
      }
    } catch {
      setError('Failed to load tunnel status')
    } finally {
      setIsLoading(false)
    }
  }

  const enableTunnel = async () => {
    try {
      const response = await fetch('/api/instance/tunnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable' }),
      })

      if (!response.ok) {
        throw new Error('Failed to enable tunnel')
      }

      await loadTunnelStatus()
      setActiveStep(1)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const steps = [
    {
      label: 'Enable Tunnel',
      content: (
        <>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Cloudflare Tunnel allows you to securely expose your local Heard Again instance to the internet without opening firewall ports.
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            This feature requires a CONNECTED plan or higher.
          </Alert>
          <Button
            variant="contained"
            onClick={enableTunnel}
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : <Cloud />}
          >
            {isLoading ? 'Loading...' : 'Enable Tunnel'}
          </Button>
        </>
      ),
    },
    {
      label: 'Install cloudflared',
      content: (
        <>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Install the Cloudflare tunnel client (cloudflared) on your server.
          </Typography>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            macOS (Homebrew):
          </Typography>
          <Paper sx={{ p: 2, bgcolor: '#1e1e1e', color: '#d4d4d4', position: 'relative' }}>
            <code>brew install cloudflared</code>
            <Button
              size="small"
              sx={{ position: 'absolute', right: 8, top: 8 }}
              onClick={() => copyToClipboard('brew install cloudflared')}
            >
              <ContentCopy fontSize="small" />
            </Button>
          </Paper>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Linux:
          </Typography>
          <Paper sx={{ p: 2, bgcolor: '#1e1e1e', color: '#d4d4d4', position: 'relative' }}>
            <code>wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared-linux-amd64.deb</code>
            <Button
              size="small"
              sx={{ position: 'absolute', right: 8, top: 8 }}
              onClick={() => copyToClipboard('wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared-linux-amd64.deb')}
            >
              <ContentCopy fontSize="small" />
            </Button>
          </Paper>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Windows (PowerShell):
          </Typography>
          <Paper sx={{ p: 2, bgcolor: '#1e1e1e', color: '#d4d4d4', position: 'relative' }}>
            <code>choco install cloudflared</code>
            <Button
              size="small"
              sx={{ position: 'absolute', right: 8, top: 8 }}
              onClick={() => copyToClipboard('choco install cloudflared')}
            >
              <ContentCopy fontSize="small" />
            </Button>
          </Paper>

          {copied && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Copied to clipboard!
            </Alert>
          )}
        </>
      ),
    },
    {
      label: 'Run Tunnel',
      content: (
        <>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Run cloudflared with your unique subdomain. This will create a secure tunnel to your local instance.
          </Typography>

          {tunnelStatus?.subdomain && (
            <>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Your tunnel command:
              </Typography>
              <Paper sx={{ p: 2, bgcolor: '#1e1e1e', color: '#d4d4d4', position: 'relative' }}>
                <code>
                  cloudflared tunnel --url http://localhost:3002 --hostname {tunnelStatus.subdomain}.heardagain.com
                </code>
                <Button
                  size="small"
                  sx={{ position: 'absolute', right: 8, top: 8 }}
                  onClick={() =>
                    copyToClipboard(
                      `cloudflared tunnel --url http://localhost:3002 --hostname ${tunnelStatus.subdomain}.heardagain.com`
                    )
                  }
                >
                  <ContentCopy fontSize="small" />
                </Button>
              </Paper>

              <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
                Or use Docker:
              </Typography>
              <Paper sx={{ p: 2, bgcolor: '#1e1e1e', color: '#d4d4d4', position: 'relative' }}>
                <code>
                  docker run --net=host cloudflare/cloudflared:latest tunnel --url http://localhost:3002
                </code>
                <Button
                  size="small"
                  sx={{ position: 'absolute', right: 8, top: 8 }}
                  onClick={() =>
                    copyToClipboard(
                      'docker run --net=host cloudflare/cloudflared:latest tunnel --url http://localhost:3002'
                    )
                  }
                >
                  <ContentCopy fontSize="small" />
                </Button>
              </Paper>

              <Alert severity="success" sx={{ mt: 2 }}>
                Your public URL: https://{tunnelStatus.subdomain}.heardagain.com
              </Alert>
            </>
          )}
        </>
      ),
    },
    {
      label: 'Verify Connection',
      content: (
        <>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Check your tunnel connection status:
          </Typography>

          {isLoading ? (
            <CircularProgress />
          ) : tunnelStatus ? (
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Chip
                    label={tunnelStatus.connectionStatus}
                    color={
                      tunnelStatus.connectionStatus === 'connected'
                        ? 'success'
                        : tunnelStatus.connectionStatus === 'error'
                        ? 'error'
                        : 'default'
                    }
                  />
                  {tunnelStatus.tokenExpired && (
                    <Chip label="Token Expired" color="warning" />
                  )}
                </Box>

                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Public URL:</strong>{' '}
                  {tunnelStatus.publicUrl || 'Not configured'}
                </Typography>

                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Subdomain:</strong> {tunnelStatus.subdomain || 'N/A'}
                </Typography>

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Refresh />}
                  onClick={loadTunnelStatus}
                  sx={{ mt: 2 }}
                >
                  Refresh Status
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Alert severity="warning">No tunnel configured</Alert>
          )}

          <Typography variant="body2" sx={{ mt: 3, color: '#6f7c7f' }}>
            The tunnel will automatically reconnect if your server restarts. For production use, consider running cloudflared as a system service.
          </Typography>
        </>
      ),
    },
  ]

  return (
    <>
      <Head>
        <title>Cloudflare Tunnel Setup - Heard Again</title>
      </Head>
      <Layout>
        <Container maxWidth="md" sx={{ py: 6 }}>
          <Typography variant="h4" className="serif-font" sx={{ color: '#16334a', mb: 2 }}>
            Cloudflare Tunnel Setup
          </Typography>
          <Typography variant="body1" sx={{ color: '#546669', mb: 4 }}>
            Securely expose your local Heard Again instance to the internet without opening firewall ports.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 4 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Stepper activeStep={activeStep} orientation="vertical">
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>
                  <Typography variant="h6" sx={{ color: '#16334a' }}>
                    {step.label}
                  </Typography>
                </StepLabel>
                <StepContent>
                  <Box sx={{ mb: 2 }}>{step.content}</Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      onClick={() =>
                        index === steps.length - 1 ? setActiveStep(steps.length) : setActiveStep(index + 1)
                      }
                      endIcon={<ArrowForward />}
                    >
                      {index === steps.length - 1 ? 'Finish' : 'Continue'}
                    </Button>
                    <Button
                      disabled={index === 0}
                      onClick={() => setActiveStep(index - 1)}
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
                🎉 Tunnel Setup Complete!
              </Typography>
              <Typography variant="body1" sx={{ color: '#546669', mb: 3 }}>
                Your Heard Again instance is now accessible from anywhere via the secure tunnel.
              </Typography>
              <Button variant="outlined" onClick={() => setActiveStep(0)}>
                View Setup Again
              </Button>
              <Divider sx={{ my: 3 }} />
              <Typography variant="body2" sx={{ color: '#6f7c7f' }}>
                Need help? Check the troubleshooting guide or contact support.
              </Typography>
            </Paper>
          )}
        </Container>
      </Layout>
    </>
  )
}
