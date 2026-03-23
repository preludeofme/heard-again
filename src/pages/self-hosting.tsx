import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  Box, Typography, Card, Button, Stepper, Step, StepLabel,
  CircularProgress, Alert, Chip, TextField, ToggleButton,
  ToggleButtonGroup, Paper, List, ListItem, ListItemIcon,
  ListItemText, Divider, Dialog, DialogTitle, DialogContent,
  DialogActions,
} from '@mui/material'
import {
  Computer, Cloud, Check, Warning, ContentCopy,
  Terminal, Storage, NetworkCheck,
} from '@mui/icons-material'

const steps = ['Choose Mode', 'Register Instance', 'Configure Tunnel', 'Verify Connection']

interface InstanceStatus {
  registered: boolean
  instance?: {
    id: string
    type: string
    status: string
    version: string
    computeMode: string
    dataMode: string
  }
  tunnel?: {
    enabled: boolean
    subdomain?: string
    publicUrl?: string
    connectionStatus?: 'connected' | 'disconnected' | 'error' | 'unknown'
    tokenExpired?: boolean
    tokenExpiresAt?: string
  }
}

export default function SelfHostingPage() {
  const [activeStep, setActiveStep] = useState(0)
  const [instanceStatus, setInstanceStatus] = useState<InstanceStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Registration form state
  const [instanceType, setInstanceType] = useState<'LOCAL' | 'HYBRID'>('LOCAL')
  const [computeMode, setComputeMode] = useState<'LOCAL' | 'CLOUD' | 'HYBRID'>('LOCAL')
  const [dataMode, setDataMode] = useState<'LOCAL' | 'CLOUD' | 'SYNCED'>('LOCAL')
  const [enableTunnel, setEnableTunnel] = useState(false)
  const [version, setVersion] = useState('1.0.0')

  // Tunnel config
  const [tunnelConfig, setTunnelConfig] = useState<any>(null)
  const [showTokenDialog, setShowTokenDialog] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/instance/status')
      const data = await res.json()
      
      if (data.success) {
        setInstanceStatus(data.data)
        
        if (data.data.registered) {
          setActiveStep(data.data.tunnel?.enabled ? 3 : 2)
          setTunnelConfig(data.data.tunnel)
        }
      }
    } catch {
      setError('Failed to fetch instance status')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    // Poll for status updates every 30 seconds
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const handleRegister = async () => {
    setIsRegistering(true)
    setError(null)
    
    try {
      const res = await fetch('/api/instance/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: instanceType,
          version,
          computeMode,
          dataMode,
          metadata: {
            registeredVia: 'web-ui',
            tunnelRequested: enableTunnel,
          },
        }),
      })

      const data = await res.json()
      
      if (data.success) {
        setInstanceStatus({
          registered: true,
          instance: data.data.instance,
          tunnel: data.data.tunnel,
        })
        setTunnelConfig(data.data.tunnel)
        setActiveStep(data.data.tunnel ? 2 : 1)
      } else {
        setError(data.error || 'Registration failed')
      }
    } catch {
      setError('Failed to register instance')
    } finally {
      setIsRegistering(false)
    }
  }

  const handleEnableTunnel = async () => {
    try {
      const res = await fetch('/api/instance/tunnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable' }),
      })

      const data = await res.json()
      
      if (data.success) {
        setTunnelConfig(data.data.tunnel)
        setShowTokenDialog(true)
        fetchStatus()
      }
    } catch {
      setError('Failed to enable tunnel')
    }
  }

  const handleDisableTunnel = async () => {
    try {
      const res = await fetch('/api/instance/tunnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      })

      if (res.ok) {
        setTunnelConfig(null)
        fetchStatus()
      }
    } catch {
      setError('Failed to disable tunnel')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (isLoading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  return (
    <>
      <Head>
        <title>Self-Hosting Setup - Heard Again</title>
        <meta name="description" content="Configure your self-hosted Heard Again instance" />
      </Head>
      <Layout>
        <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4', px: { xs: 3, md: 8 }, py: 8 }}>
          <Box sx={{ maxWidth: 900, mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ mb: 6 }}>
              <Typography
                variant="h3"
                className="serif-font"
                sx={{ color: '#16334a', fontStyle: 'italic', mb: 1 }}
              >
                Self-Hosting Setup
              </Typography>
              <Typography variant="body1" sx={{ color: '#546669' }}>
                Configure your local instance and optionally enable cloud tunnel access.
              </Typography>
            </Box>

            {/* Error Alert */}
            {error && (
              <Alert severity="error" sx={{ mb: 4 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Status Card */}
            {instanceStatus?.registered && (
              <Card sx={{ p: 3, borderRadius: 3, mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                  <Box>
                    <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600 }}>
                      Instance Status
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                      <Chip
                        label={instanceStatus.instance?.status}
                        size="small"
                        sx={{
                          backgroundColor: instanceStatus.instance?.status === 'ACTIVE' ? '#d0e3e6' : '#ffebee',
                          color: instanceStatus.instance?.status === 'ACTIVE' ? '#16334a' : '#c62828',
                        }}
                      />
                      <Chip
                        label={`${instanceStatus.instance?.type} / ${instanceStatus.instance?.computeMode}`}
                        size="small"
                        sx={{ backgroundColor: '#f6f3ee', color: '#546669' }}
                      />
                    </Box>
                  </Box>
                  
                  {instanceStatus.tunnel?.enabled && (
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" sx={{ color: '#546669' }}>
                        Tunnel Status
                      </Typography>
                      <Chip
                        label={instanceStatus.tunnel.connectionStatus || 'unknown'}
                        size="small"
                        sx={{
                          backgroundColor: 
                            instanceStatus.tunnel.connectionStatus === 'connected' ? '#d0e3e6' :
                            instanceStatus.tunnel.connectionStatus === 'error' ? '#ffebee' : '#f6f3ee',
                          color: 
                            instanceStatus.tunnel.connectionStatus === 'connected' ? '#16334a' :
                            instanceStatus.tunnel.connectionStatus === 'error' ? '#c62828' : '#999',
                          textTransform: 'capitalize',
                        }}
                      />
                    </Box>
                  )}
                </Box>

                {instanceStatus.tunnel?.enabled && instanceStatus.tunnel.publicUrl && (
                  <Box sx={{ mt: 3, p: 2, backgroundColor: '#f6f3ee', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ color: '#546669', mb: 1 }}>
                      Public URL
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="body1"
                        component="a"
                        href={instanceStatus.tunnel.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ color: '#16334a', fontWeight: 500, textDecoration: 'none' }}
                      >
                        {instanceStatus.tunnel.publicUrl}
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<ContentCopy />}
                        onClick={() => copyToClipboard(instanceStatus.tunnel?.publicUrl || '')}
                        sx={{ ml: 2 }}
                      >
                        Copy
                      </Button>
                    </Box>
                  </Box>
                )}
              </Card>
            )}

            {/* Stepper */}
            <Stepper activeStep={activeStep} sx={{ mb: 6 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {/* Step 1: Choose Mode */}
            {activeStep === 0 && !instanceStatus?.registered && (
              <Card sx={{ p: 4, borderRadius: 4 }}>
                <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600, mb: 3 }}>
                  1. Choose Your Deployment Mode
                </Typography>

                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle2" sx={{ color: '#546669', mb: 2 }}>
                    Instance Type
                  </Typography>
                  <ToggleButtonGroup
                    value={instanceType}
                    exclusive
                    onChange={(e, value) => value && setInstanceType(value)}
                    sx={{ width: '100%' }}
                  >
                    <ToggleButton value="LOCAL" sx={{ flex: 1, py: 2 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Computer sx={{ fontSize: 32, mb: 1, color: '#16334a' }} />
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>Local Only</Typography>
                        <Typography variant="caption" sx={{ color: '#999' }}>
                          Everything on your machine
                        </Typography>
                      </Box>
                    </ToggleButton>
                    <ToggleButton value="HYBRID" sx={{ flex: 1, py: 2 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Cloud sx={{ fontSize: 32, mb: 1, color: '#16334a' }} />
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>Connected</Typography>
                        <Typography variant="caption" sx={{ color: '#999' }}>
                          Local data + cloud tunnel
                        </Typography>
                      </Box>
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle2" sx={{ color: '#546669', mb: 2 }}>
                    Compute Mode
                  </Typography>
                  <ToggleButtonGroup
                    value={computeMode}
                    exclusive
                    onChange={(e, value) => value && setComputeMode(value)}
                    sx={{ width: '100%' }}
                  >
                    <ToggleButton value="LOCAL" sx={{ flex: 1 }}>
                      <Storage sx={{ mr: 1 }} />
                      Local GPU
                    </ToggleButton>
                    <ToggleButton value="HYBRID" sx={{ flex: 1 }}>
                      <Computer sx={{ mr: 1 }} />
                      Hybrid
                    </ToggleButton>
                    <ToggleButton value="CLOUD" sx={{ flex: 1 }}>
                      <Cloud sx={{ mr: 1 }} />
                      Cloud Only
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle2" sx={{ color: '#546669', mb: 2 }}>
                    Data Storage
                  </Typography>
                  <ToggleButtonGroup
                    value={dataMode}
                    exclusive
                    onChange={(e, value) => value && setDataMode(value)}
                    sx={{ width: '100%' }}
                  >
                    <ToggleButton value="LOCAL" sx={{ flex: 1 }}>
                      Local Only
                    </ToggleButton>
                    <ToggleButton value="SYNCED" sx={{ flex: 1 }}>
                      Sync to Cloud
                    </ToggleButton>
                    <ToggleButton value="CLOUD" sx={{ flex: 1 }}>
                      Cloud Only
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => setActiveStep(1)}
                  sx={{
                    py: 2,
                    backgroundColor: '#16334a',
                    borderRadius: 3,
                    '&:hover': { backgroundColor: '#2e4a62' },
                  }}
                >
                  Continue to Registration
                </Button>
              </Card>
            )}

            {/* Step 2: Register Instance */}
            {(activeStep === 1 || (activeStep === 0 && instanceStatus?.registered)) && !instanceStatus?.registered && (
              <Card sx={{ p: 4, borderRadius: 4 }}>
                <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600, mb: 3 }}>
                  2. Register Your Instance
                </Typography>

                <Alert severity="info" sx={{ mb: 3 }}>
                  This will create a record for your self-hosted instance and enable API access.
                </Alert>

                <TextField
                  fullWidth
                  label="Version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  sx={{ mb: 3 }}
                />

                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" sx={{ color: '#546669', mb: 2 }}>
                    Configuration Summary:
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><Computer fontSize="small" /></ListItemIcon>
                      <ListItemText primary={`Type: ${instanceType}`} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Storage fontSize="small" /></ListItemIcon>
                      <ListItemText primary={`Compute: ${computeMode}`} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Cloud fontSize="small" /></ListItemIcon>
                      <ListItemText primary={`Storage: ${dataMode}`} />
                    </ListItem>
                  </List>
                </Box>

                {instanceType === 'HYBRID' && (
                  <Alert severity="warning" sx={{ mb: 3 }}>
                    Connected mode requires a plan with tunnel support. You'll be able to enable the tunnel after registration if your plan supports it.
                  </Alert>
                )}

                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleRegister}
                  disabled={isRegistering}
                  sx={{
                    py: 2,
                    backgroundColor: '#16334a',
                    borderRadius: 3,
                    '&:hover': { backgroundColor: '#2e4a62' },
                  }}
                >
                  {isRegistering ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Register Instance'}
                </Button>
              </Card>
            )}

            {/* Step 3: Configure Tunnel */}
            {activeStep === 2 && instanceStatus?.registered && !instanceStatus.tunnel?.enabled && (
              <Card sx={{ p: 4, borderRadius: 4 }}>
                <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600, mb: 3 }}>
                  3. Configure Cloud Tunnel (Optional)
                </Typography>

                <Alert severity="info" sx={{ mb: 3 }}>
                  Enable a secure tunnel to access your instance from anywhere via{' '}
                  <strong>https://your-subdomain.heardagain.com</strong>
                </Alert>

                <Typography variant="body1" sx={{ color: '#546669', mb: 3 }}>
                  Benefits of enabling the tunnel:
                </Typography>

                <List sx={{ mb: 4 }}>
                  <ListItem>
                    <ListItemIcon><Check color="success" /></ListItemIcon>
                    <ListItemText primary="Access from any device, anywhere" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><Check color="success" /></ListItemIcon>
                    <ListItemText primary="Share with family members easily" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><Check color="success" /></ListItemIcon>
                    <ListItemText primary="SSL certificate included" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><Check color="success" /></ListItemIcon>
                    <ListItemText primary="No port forwarding required" />
                  </ListItem>
                </List>

                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleEnableTunnel}
                  sx={{
                    py: 2,
                    backgroundColor: '#16334a',
                    borderRadius: 3,
                    '&:hover': { backgroundColor: '#2e4a62' },
                  }}
                >
                  Enable Cloud Tunnel
                </Button>

                <Button
                  fullWidth
                  onClick={() => setActiveStep(3)}
                  sx={{ mt: 2, color: '#546669' }}
                >
                  Skip for now
                </Button>
              </Card>
            )}

            {/* Step 4: Verify Connection / Tunnel Active */}
            {((activeStep === 3) || (instanceStatus?.tunnel?.enabled)) && (
              <Card sx={{ p: 4, borderRadius: 4 }}>
                <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600, mb: 3 }}>
                  {instanceStatus?.tunnel?.enabled ? 'Tunnel Configuration' : 'Setup Complete'}
                </Typography>

                {instanceStatus?.tunnel?.enabled && tunnelConfig && (
                  <>
                    <Alert 
                      severity={instanceStatus.tunnel.connectionStatus === 'connected' ? 'success' : 'warning'}
                      sx={{ mb: 3 }}
                      icon={instanceStatus.tunnel.connectionStatus === 'connected' ? <Check /> : <Warning />}
                    >
                      {instanceStatus.tunnel.connectionStatus === 'connected'
                        ? 'Your tunnel is connected and accessible!'
                        : 'Tunnel is configured but not yet connected. Follow the steps below.'}
                    </Alert>

                    <Box sx={{ mb: 4 }}>
                      <Typography variant="subtitle2" sx={{ color: '#546669', mb: 2 }}>
                        Your Public URL
                      </Typography>
                      <Paper sx={{ p: 2, backgroundColor: '#f6f3ee' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography
                            component="a"
                            href={tunnelConfig.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ color: '#16334a', fontWeight: 500, textDecoration: 'none' }}
                          >
                            {tunnelConfig.publicUrl}
                          </Typography>
                          <Button
                            size="small"
                            startIcon={<ContentCopy />}
                            onClick={() => copyToClipboard(tunnelConfig.publicUrl)}
                          >
                            Copy
                          </Button>
                        </Box>
                      </Paper>
                    </Box>

                    <Typography variant="subtitle2" sx={{ color: '#546669', mb: 2 }}>
                      Setup Instructions
                    </Typography>

                    <Paper sx={{ p: 3, backgroundColor: '#f6f3ee', mb: 3 }}>
                      <Typography variant="body2" sx={{ color: '#546669', mb: 2 }}>
                        <strong>Option 1: Quick Start (Docker)</strong>
                      </Typography>
                      <CodeBlock>
                        docker run -d --name heardagain-tunnel \\\n  cloudflare/cloudflared:latest tunnel \\\n  --no-autoupdate run \\\n  --token {tunnelConfig.token}
                      </CodeBlock>

                      <Divider sx={{ my: 3 }} />

                      <Typography variant="body2" sx={{ color: '#546669', mb: 2 }}>
                        <strong>Option 2: Native Install</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#546669', mb: 1 }}>
                        1. Install cloudflared:{' '}
                        <a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/" target="_blank" rel="noopener noreferrer" style={{ color: '#16334a' }}>
                          Installation Guide
                        </a>
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#546669', mb: 1 }}>
                        2. Run the tunnel:
                      </Typography>
                      <CodeBlock>
                        cloudflared tunnel --url http://localhost:3002 \\\n  --hostname {tunnelConfig.subdomain}.heardagain.com
                      </CodeBlock>
                    </Paper>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={handleDisableTunnel}
                        sx={{ flex: 1, borderRadius: 3 }}
                      >
                        Disable Tunnel
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => setShowTokenDialog(true)}
                        sx={{ flex: 1, borderRadius: 3 }}
                      >
                        View Token
                      </Button>
                    </Box>
                  </>
                )}

                {!instanceStatus?.tunnel?.enabled && (
                  <>
                    <Alert severity="success" sx={{ mb: 3 }} icon={<Check />}>
                      Your local instance is registered and ready!
                    </Alert>
                    
                    <Typography variant="body1" sx={{ color: '#546669', mb: 2 }}>
                      Your Heard Again instance is now running locally on{' '}
                      <strong>http://localhost:3002</strong>
                    </Typography>

                    <Button
                      variant="contained"
                      onClick={handleEnableTunnel}
                      sx={{
                        mt: 2,
                        py: 1.5,
                        px: 4,
                        backgroundColor: '#16334a',
                        borderRadius: 3,
                        '&:hover': { backgroundColor: '#2e4a62' },
                      }}
                    >
                      Enable Cloud Tunnel
                    </Button>
                  </>
                )}
              </Card>
            )}
          </Box>
        </Box>

        {/* Token Dialog */}
        <Dialog open={showTokenDialog} onClose={() => setShowTokenDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Tunnel Token</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: '#546669', mb: 2 }}>
              Keep this token secure. It provides access to your tunnel.
            </Typography>
            <Paper sx={{ p: 2, backgroundColor: '#f6f3ee' }}>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  userSelect: 'all',
                }}
              >
                {tunnelConfig?.token}
              </Typography>
            </Paper>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowTokenDialog(false)}>Close</Button>
            <Button
              onClick={() => copyToClipboard(tunnelConfig?.token || '')}
              startIcon={<ContentCopy />}
              variant="contained"
            >
              Copy Token
            </Button>
          </DialogActions>
        </Dialog>
      </Layout>
    </>
  )
}

function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <Paper
      sx={{
        p: 2,
        backgroundColor: '#1c1c19',
        color: '#fcf9f4',
        fontFamily: 'monospace',
        fontSize: '0.85rem',
        overflowX: 'auto',
        borderRadius: 2,
      }}
    >
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{children}</pre>
    </Paper>
  )
}
