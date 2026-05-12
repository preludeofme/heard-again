import Head from 'next/head'
import { useEffect, useState } from 'react'
import { fetchWithCSRFAndJSON } from '@/lib/api-client'
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab,
} from '@mui/material'
import {
  Check,
  Cloud,
  ContentCopy,
  Computer,
  ArrowForward,
  ArrowBack,
  Refresh,
  Download,
  Delete,
  Settings,
} from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'

interface TunnelStatus {
  enabled: boolean
  type?: 'quick' | 'named'
  id?: string
  name?: string
  subdomain: string | null
  publicUrl: string | null
  tokenExpired: boolean
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'unknown'
  dnsConfigured?: boolean
}

type TunnelMode = 'quick' | 'named'

interface ConfigFile {
  name: string
  content: string
}

export default function TunnelSetup() {
  const [activeStep, setActiveStep] = useState(0)
  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [tunnelMode, setTunnelMode] = useState<TunnelMode>('named')
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false)
  const [configFiles, setConfigFiles] = useState<Record<string, string> | null>(null)
  const [isCreatingTunnel, setIsCreatingTunnel] = useState(false)

  useEffect(() => {
    loadTunnelStatus()
  }, [])

  const loadTunnelStatus = async () => {
    try {
      const response = await fetch('/api/instance/status', { credentials: 'include' })
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

  const createNamedTunnel = async () => {
    setIsCreatingTunnel(true)
    try {
      const response = await fetchWithCSRFAndJSON('/api/instance/tunnel-v2', { action: 'create-named' })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create tunnel')
      }

      setTunnelStatus(data.tunnel)
      setActiveStep(2) // Skip to Run Tunnel step
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsCreatingTunnel(false)
    }
  }

  const createQuickTunnel = async () => {
    setIsCreatingTunnel(true)
    try {
      const response = await fetchWithCSRFAndJSON('/api/instance/tunnel-v2', { action: 'enable' })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to enable tunnel')
      }

      setTunnelStatus(data.tunnel)
      setActiveStep(2)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsCreatingTunnel(false)
    }
  }

  const downloadCredentials = async () => {
    try {
      const response = await fetchWithCSRFAndJSON('/api/instance/tunnel-v2', { action: 'get-credentials' })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to get credentials')
      }

      setConfigFiles(data.files)
      setShowCredentialsDialog(true)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const deleteTunnel = async () => {
    if (!confirm('Are you sure you want to delete this tunnel? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetchWithCSRFAndJSON('/api/instance/tunnel-v2', {
        action: tunnelStatus?.type === 'named' ? 'delete-named' : 'disable',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to delete tunnel')
      }

      setTunnelStatus(null)
      setActiveStep(0)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const enableTunnel = async () => {
    try {
      const response = await fetchWithCSRFAndJSON('/api/instance/tunnel', { action: 'enable' })

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
      label: 'Choose Tunnel Mode',
      content: (
        <>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Cloudflare Tunnel allows you to securely expose your local Heard Again instance to the internet without opening firewall ports.
          </Typography>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            This feature requires a CONNECTED plan or higher.
          </Alert>

          <Tabs
            value={tunnelMode}
            onChange={(_, value) => setTunnelMode(value)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ mb: 3 }}
          >
            <Tab value="named" label="Named Tunnel (Production)" />
            <Tab value="quick" label="Quick Tunnel (Testing)" />
          </Tabs>

          {tunnelMode === 'named' ? (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#2e7d32' }}>
                ✅ Recommended for Production
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#546669' }}>
                • Persistent tunnel that survives restarts
                • Permanent URL (e.g., family-buck-4k2m.heardagain.com)
                • Auto-reconnects if connection drops
                • Downloadable config files for systemd/Docker
              </Typography>
              <Button
                variant="contained"
                onClick={createNamedTunnel}
                disabled={isCreatingTunnel || isLoading}
                startIcon={isCreatingTunnel ? <CircularProgress size={20} /> : <Cloud />}
              >
                {isCreatingTunnel ? 'Creating...' : 'Create Named Tunnel'}
              </Button>
            </Box>
          ) : (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#ed6c02' }}>
                ⚠️ For Testing Only
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#546669' }}>
                • Temporary tunnel URL
                • Must restart cloudflared after disconnect
                • Good for quick testing without API setup
              </Typography>
              <Button
                variant="outlined"
                onClick={createQuickTunnel}
                disabled={isCreatingTunnel || isLoading}
                startIcon={isCreatingTunnel ? <CircularProgress size={20} /> : <Cloud />}
              >
                {isCreatingTunnel ? 'Creating...' : 'Create Quick Tunnel'}
              </Button>
            </Box>
          )}
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
      label: tunnelMode === 'named' ? 'Configure & Run Tunnel' : 'Run Tunnel',
      content: (
        <>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {tunnelMode === 'named' 
              ? 'Download your configuration files and start the tunnel.'
              : 'Run cloudflared with your unique subdomain.'}
          </Typography>

          {tunnelStatus?.type === 'named' && (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                <strong>Your permanent URL:</strong> https://{tunnelStatus.subdomain}
              </Alert>
              
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Download configuration files:
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
                <Button
                  variant="contained"
                  startIcon={<Download />}
                  onClick={downloadCredentials}
                >
                  Download Config Files
                </Button>
              </Box>

              <Typography variant="body2" sx={{ mb: 2, color: '#546669' }}>
                Or run directly with the tunnel token:
              </Typography>
              
              <Paper sx={{ p: 2, bgcolor: '#1e1e1e', color: '#d4d4d4', position: 'relative' }}>
                <code>cloudflared tunnel run --token YOUR_TOKEN</code>
                <Button
                  size="small"
                  sx={{ position: 'absolute', right: 8, top: 8 }}
                  onClick={() => setShowCredentialsDialog(true)}
                >
                  <Settings fontSize="small" />
                </Button>
              </Paper>
            </>
          )}

          {tunnelStatus?.type === 'quick' && tunnelStatus?.subdomain && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <strong>Your temporary URL:</strong> https://{tunnelStatus.subdomain}
                <br />
                This URL will change if cloudflared restarts.
              </Alert>

              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Run this command:
              </Typography>
              <Paper sx={{ p: 2, bgcolor: '#1e1e1e', color: '#d4d4d4', position: 'relative' }}>
                <code>
                  cloudflared tunnel --url http://localhost:4777 --hostname {tunnelStatus.subdomain}.heardagain.com
                </code>
                <Button
                  size="small"
                  sx={{ position: 'absolute', right: 8, top: 8 }}
                  onClick={() =>
                    copyToClipboard(
                      `cloudflared tunnel --url http://localhost:4777 --hostname ${tunnelStatus.subdomain}.heardagain.com`
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
                  docker run --net=host cloudflare/cloudflared:latest tunnel --url http://localhost:4777
                </code>
                <Button
                  size="small"
                  sx={{ position: 'absolute', right: 8, top: 8 }}
                  onClick={() =>
                    copyToClipboard(
                      'docker run --net=host cloudflare/cloudflared:latest tunnel --url http://localhost:4777'
                    )
                  }
                >
                  <ContentCopy fontSize="small" />
                </Button>
              </Paper>
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
                  {tunnelStatus.type === 'named' && (
                    <Chip label="Named Tunnel" color="primary" variant="outlined" />
                  )}
                </Box>

                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Public URL:</strong>{' '}
                  {tunnelStatus.publicUrl || 'Not configured'}
                </Typography>

                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Subdomain:</strong> {tunnelStatus.subdomain || 'N/A'}
                </Typography>

                {tunnelStatus.type === 'named' && (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Tunnel ID:</strong> {tunnelStatus.id}
                  </Typography>
                )}

                <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Refresh />}
                    onClick={loadTunnelStatus}
                  >
                    Refresh Status
                  </Button>
                  
                  {tunnelStatus.type === 'named' && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Download />}
                      onClick={downloadCredentials}
                    >
                      Download Config
                    </Button>
                  )}
                  
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<Delete />}
                    onClick={deleteTunnel}
                  >
                    Delete Tunnel
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ) : (
            <Alert severity="warning">No tunnel configured</Alert>
          )}

          <Typography variant="body2" sx={{ mt: 3, color: '#6f7c7f' }}>
            {tunnelStatus?.type === 'named' 
              ? 'Named tunnels automatically reconnect after restarts. The configuration files handle this automatically.'
              : 'Quick tunnels will need to be restarted manually if the connection drops.'}
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

          {/* Credentials Download Dialog */}
          <Dialog
            open={showCredentialsDialog}
            onClose={() => setShowCredentialsDialog(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              Download Tunnel Configuration Files
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ mb: 2, color: '#546669' }}>
                Download these files to your server to configure cloudflared:
              </Typography>
              
              {configFiles && (
                <List>
                  {Object.entries(configFiles).map(([filename, content]) => (
                    <ListItem key={filename} divider>
                      <ListItemText
                        primary={filename}
                        secondary={`${content.length} characters`}
                      />
                      <Button
                        size="small"
                        startIcon={<Download />}
                        onClick={() => downloadFile(filename, content)}
                      >
                        Download
                      </Button>
                    </ListItem>
                  ))}
                </List>
              )}

              <Alert severity="info" sx={{ mt: 2 }}>
                <strong>Quick Start:</strong>
                <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>Create directory: <code>sudo mkdir -p /etc/cloudflared</code></li>
                  <li>Save <strong>credentials.json</strong> to <code>/etc/cloudflared/</code></li>
                  <li>Save <strong>cloudflared-config.yml</strong> to <code>/etc/cloudflared/config.yml</code></li>
                  <li>Run: <code>sudo cloudflared service install</code></li>
                  <li>Start: <code>sudo systemctl start cloudflared</code></li>
                </ol>
              </Alert>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowCredentialsDialog(false)}>
                Close
              </Button>
            </DialogActions>
          </Dialog>
        </Container>
      </Layout>
    </>
  )
}


export async function getServerSideProps() { return { props: {} } }
