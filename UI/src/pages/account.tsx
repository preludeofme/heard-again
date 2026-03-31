import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import {
  Person,
  CreditCard,
  Cloud,
  Computer,
  Shield,
  ArrowForward,
  Check,
  Warning,
  Refresh,
  Storage,
  RecordVoiceOver,
  Group,
} from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'

interface User {
  id: string
  name: string | null
  email: string
  image: string | null
  role: string
}

interface Plan {
  id: string
  name: string
  planType: string
  pricing: {
    monthlyCents: number
    monthlyDisplay: string
  }
  entitlements: {
    tunnelEnabled: boolean
    cloudGpuEnabled: boolean
    generationMinutesIncluded: number
    storageQuotaBytes: number
    memberQuota: number
    voiceProfileQuota: number
  }
}

interface Subscription {
  id: string
  billingStatus: string
  renewalDate: string | null
  cancelledAt: string | null
  stripeSubscriptionId: string | null
  usage: {
    generationMinutesUsed: number
    storageBytesUsed: number
    lastBillingResetAt: string
  }
  plan: Plan | null
}

interface TunnelStatus {
  enabled: boolean
  subdomain: string | null
  publicUrl: string | null
  tokenExpired: boolean
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'unknown'
  lastHeartbeatMinutes: number | null
}

interface Instance {
  id: string
  type: string
  status: string
  version: string
  computeMode: string
  dataMode: string
  registeredAt: string
  lastHeartbeatAt: string | null
}

interface TestOverrides {
  bypassPermissionChecks: boolean
  mockPaidPlan: boolean
  unlimitedUsage: boolean
  debugMode: boolean
}

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null
}

export default function AccountPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // User data
  const [user, setUser] = useState<User | null>(null)
  const [workspaceRole, setWorkspaceRole] = useState<string>('MEMBER')

  // Subscription data
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [isChangePlanDialogOpen, setIsChangePlanDialogOpen] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')

  // Instance/Tunnel data
  const [instance, setInstance] = useState<Instance | null>(null)
  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus | null>(null)

  // Test overrides
  const [overrides, setOverrides] = useState<TestOverrides>({
    bypassPermissionChecks: false,
    mockPaidPlan: false,
    unlimitedUsage: false,
    debugMode: false,
  })

  // Load all data
  useEffect(() => {
    loadData()
    // Load saved test overrides from localStorage
    const savedOverrides = localStorage.getItem('testOverrides')
    if (savedOverrides) {
      try {
        setOverrides(JSON.parse(savedOverrides))
      } catch {
        // ignore parse error
      }
    }
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Get current user
      const userRes = await fetch('/api/auth/session', { credentials: 'include' })
      const userData = await userRes.json()
      if (userData?.user) {
        setUser(userData.user)
      }

      // Get subscription
      try {
        const subRes = await fetch('/api/billing/subscription', { credentials: 'include' })
        const subData = await subRes.json()
        if (subData.success) {
          setSubscription(subData.data)
        }
      } catch {
        // No subscription is ok
      }

      // Get plans
      const plansRes = await fetch('/api/billing/plans', { credentials: 'include' })
      const plansData = await plansRes.json()
      if (plansData.success) {
        setPlans(plansData.data.plans)
      }

      // Get instance/tunnel status
      const instanceRes = await fetch('/api/instance/status', { credentials: 'include' })
      const instanceData = await instanceRes.json()
      if (instanceData.success) {
        setInstance(instanceData.data.instance || null)
        setTunnelStatus(instanceData.data.tunnel || null)
        setWorkspaceRole(instanceData.data.workspaceRole || 'MEMBER')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load account data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to cancel')
      setSuccess('Subscription cancelled successfully')
      setIsCancelDialogOpen(false)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleChangePlan = async () => {
    if (!selectedPlanId) return
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planId: selectedPlanId, billingCycle: 'monthly' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to change plan')
      setSuccess('Plan changed successfully')
      setIsChangePlanDialogOpen(false)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleTunnelAction = async (action: 'enable' | 'disable' | 'regenerate' | 'rotate-token') => {
    try {
      const res = await fetch('/api/instance/tunnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update tunnel')
      setSuccess(`Tunnel ${action}d successfully`)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const updateOverride = async (key: keyof TestOverrides, value: boolean) => {
    const newOverrides = { ...overrides, [key]: value }
    setOverrides(newOverrides)
    localStorage.setItem('testOverrides', JSON.stringify(newOverrides))
    
    // Sync with server
    try {
      await fetch('/api/test-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [key]: value }),
      })
      setSuccess(`${key} ${value ? 'enabled' : 'disabled'} for testing`)
    } catch {
      // Local override is still active even if server sync fails
      setSuccess(`${key} ${value ? 'enabled' : 'disabled'} locally (server sync failed)`)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
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
        <title>Account - Heard Again</title>
      </Head>
      <Layout>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Typography variant="h4" className="serif-font" sx={{ color: '#16334a', mb: 3 }}>
            Account Settings
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
              <Tab icon={<Person />} label="Profile" />
              <Tab icon={<CreditCard />} label="Subscription" />
              <Tab icon={<Cloud />} label="Instance & Tunnel" />
              <Tab icon={<Shield />} label="Test Overrides" />
            </Tabs>
          </Box>

          {/* Profile Tab */}
          <TabPanel value={activeTab} index={0}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3 }}>
                  Profile Information
                </Typography>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Name"
                      value={user?.name || ''}
                      disabled
                      helperText="Name is managed through your authentication provider"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Email"
                      value={user?.email || ''}
                      disabled
                      helperText="Email is managed through your authentication provider"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Workspace Role"
                      value={workspaceRole}
                      disabled
                      helperText="Your role in the current workspace"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="User ID"
                      value={user?.id || ''}
                      disabled
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TabPanel>

          {/* Subscription Tab */}
          <TabPanel value={activeTab} index={1}>
            <Stack spacing={3}>
              {/* Current Plan */}
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                    <Typography variant="h6">Current Plan</Typography>
                    <Chip
                      label={subscription?.billingStatus || 'NO SUBSCRIPTION'}
                      color={subscription?.billingStatus === 'ACTIVE' ? 'success' : 'default'}
                    />
                  </Box>

                  {subscription?.plan ? (
                    <>
                      <Typography variant="h4" sx={{ color: '#16334a', mb: 1 }}>
                        {subscription.plan.name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#6f7c7f', mb: 3 }}>
                        ${subscription.plan.pricing.monthlyDisplay}/month
                        {subscription.renewalDate && (
                          <> · Renews on {new Date(subscription.renewalDate).toLocaleDateString()}</>
                        )}
                      </Typography>

                      {/* Usage Stats */}
                      <Typography variant="subtitle2" sx={{ mb: 2 }}>
                        Current Usage
                      </Typography>
                      <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <Paper sx={{ p: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              Storage Used
                            </Typography>
                            <Typography variant="h6">
                              {formatBytes(subscription.usage?.storageBytesUsed || 0)}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(
                                ((subscription.usage?.storageBytesUsed || 0) / subscription.plan.entitlements.storageQuotaBytes) * 100,
                                100
                              )}
                              sx={{ mt: 1 }}
                            />
                          </Paper>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <Paper sx={{ p: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              Voice Minutes
                            </Typography>
                            <Typography variant="h6">
                              {Math.round((subscription.usage?.generationMinutesUsed || 0) * 10) / 10} min
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(
                                ((subscription.usage?.generationMinutesUsed || 0) / subscription.plan.entitlements.generationMinutesIncluded) * 100,
                                100
                              )}
                              sx={{ mt: 1 }}
                            />
                          </Paper>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <Paper sx={{ p: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              Plan Features
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                              {subscription.plan.entitlements.tunnelEnabled && (
                                <Chip size="small" icon={<Cloud />} label="Tunnel" />
                              )}
                              {subscription.plan.entitlements.cloudGpuEnabled && (
                                <Chip size="small" icon={<Computer />} label="Cloud GPU" />
                              )}
                            </Stack>
                          </Paper>
                        </Grid>
                      </Grid>

                      <Stack direction="row" spacing={2}>
                        <Button
                          variant="outlined"
                          onClick={() => setIsChangePlanDialogOpen(true)}
                        >
                          Change Plan
                        </Button>
                        {subscription.plan.planType !== 'FREE' && (
                          <Button
                            variant="outlined"
                            color="error"
                            onClick={() => setIsCancelDialogOpen(true)}
                          >
                            Cancel Subscription
                          </Button>
                        )}
                      </Stack>
                    </>
                  ) : (
                    <>
                      <Alert severity="info" sx={{ mb: 3 }}>
                        You don't have an active subscription. Subscribe to a plan to unlock premium features.
                      </Alert>
                      <Button
                        variant="contained"
                        onClick={() => router.push('/pricing')}
                      >
                        View Plans
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Available Plans */}
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Available Plans
                  </Typography>
                  <List>
                    {plans.map((plan) => (
                      <ListItem key={plan.id}>
                        <ListItemText
                          primary={plan.name}
                          secondary={`$${plan.pricing.monthlyDisplay}/month · ${plan.entitlements.generationMinutesIncluded} min · ${formatBytes(plan.entitlements.storageQuotaBytes)}`}
                        />
                        {subscription?.plan?.id === plan.id ? (
                          <Chip size="small" color="primary" label="Current" />
                        ) : (
                          <Button
                            size="small"
                            onClick={() => {
                              setSelectedPlanId(plan.id)
                              setIsChangePlanDialogOpen(true)
                            }}
                          >
                            Select
                          </Button>
                        )}
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Stack>
          </TabPanel>

          {/* Instance & Tunnel Tab */}
          <TabPanel value={activeTab} index={2}>
            <Stack spacing={3}>
              {/* Instance Status */}
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6">Instance Status</Typography>
                    <Button
                      startIcon={<Refresh />}
                      size="small"
                      onClick={loadData}
                    >
                      Refresh
                    </Button>
                  </Box>

                  {instance ? (
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6, md: 3 }}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            Type
                          </Typography>
                          <Typography variant="h6">{instance.type}</Typography>
                        </Paper>
                      </Grid>
                      <Grid size={{ xs: 6, md: 3 }}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            Status
                          </Typography>
                          <Chip
                            size="small"
                            label={instance.status}
                            color={instance.status === 'ACTIVE' ? 'success' : 'default'}
                          />
                        </Paper>
                      </Grid>
                      <Grid size={{ xs: 6, md: 3 }}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            Compute
                          </Typography>
                          <Typography variant="h6">{instance.computeMode}</Typography>
                        </Paper>
                      </Grid>
                      <Grid size={{ xs: 6, md: 3 }}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            Data
                          </Typography>
                          <Typography variant="h6">{instance.dataMode}</Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  ) : (
                    <Alert severity="info">
                      No instance registered. Register an instance to enable cloud features.
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Tunnel Status */}
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3 }}>
                    Cloudflare Tunnel
                  </Typography>

                  {tunnelStatus?.enabled ? (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        <Chip
                          label={tunnelStatus.connectionStatus}
                          color={
                            tunnelStatus.connectionStatus === 'connected'
                              ? 'success'
                              : tunnelStatus.connectionStatus === 'error'
                              ? 'error'
                              : 'warning'
                          }
                        />
                        {tunnelStatus.tokenExpired && (
                          <Chip label="Token Expired" color="error" />
                        )}
                        {tunnelStatus.lastHeartbeatMinutes !== null && (
                          <Typography variant="body2" color="text.secondary">
                            Last heartbeat: {tunnelStatus.lastHeartbeatMinutes}m ago
                          </Typography>
                        )}
                      </Box>

                      {tunnelStatus.publicUrl && (
                        <Alert severity="success" sx={{ mb: 3 }}>
                          <Typography variant="body2">
                            <strong>Public URL:</strong>{' '}
                            <a href={tunnelStatus.publicUrl} target="_blank" rel="noopener noreferrer">
                              {tunnelStatus.publicUrl}
                            </a>
                          </Typography>
                        </Alert>
                      )}

                      <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleTunnelAction('regenerate')}
                        >
                          Regenerate Subdomain
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleTunnelAction('rotate-token')}
                        >
                          Rotate Token
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => handleTunnelAction('disable')}
                        >
                          Disable Tunnel
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => router.push('/tunnel-setup')}
                        >
                          Setup Guide
                        </Button>
                      </Stack>
                    </>
                  ) : (
                    <>
                      <Alert severity="info" sx={{ mb: 3 }}>
                        Tunnel is not enabled. Enable it to access your instance from anywhere.
                      </Alert>
                      <Button
                        variant="contained"
                        startIcon={<Cloud />}
                        onClick={() => handleTunnelAction('enable')}
                      >
                        Enable Tunnel
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Quick Actions
                  </Typography>
                  <List>
                    <ListItemButton onClick={() => router.push('/setup-guide')}>
                      <ListItemIcon>
                        <Computer />
                      </ListItemIcon>
                      <ListItemText
                        primary="Self-Hosting Guide"
                        secondary="Learn how to set up your own instance"
                      />
                      <ArrowForward />
                    </ListItemButton>
                    <ListItemButton onClick={() => router.push('/tunnel-setup')}>
                      <ListItemIcon>
                        <Cloud />
                      </ListItemIcon>
                      <ListItemText
                        primary="Tunnel Setup"
                        secondary="Configure Cloudflare tunnel access"
                      />
                      <ArrowForward />
                    </ListItemButton>
                  </List>
                </CardContent>
              </Card>
            </Stack>
          </TabPanel>

          {/* Test Overrides Tab */}
          <TabPanel value={activeTab} index={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Testing Overrides
                </Typography>
                <Alert severity="warning" sx={{ mb: 3 }}>
                  These settings bypass normal permission and quota checks. Only use for testing!
                </Alert>

                <Stack spacing={2}>
                  <Paper sx={{ p: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={overrides.bypassPermissionChecks}
                          onChange={(e) => updateOverride('bypassPermissionChecks', e.target.checked)}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="subtitle1">Bypass Permission Checks</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Allows all actions regardless of workspace role or ownership
                          </Typography>
                        </Box>
                      }
                    />
                  </Paper>

                  <Paper sx={{ p: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={overrides.mockPaidPlan}
                          onChange={(e) => updateOverride('mockPaidPlan', e.target.checked)}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="subtitle1">Mock Paid Plan</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Pretend to have a paid plan (tunnel, cloud GPU, etc.)
                          </Typography>
                        </Box>
                      }
                    />
                  </Paper>

                  <Paper sx={{ p: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={overrides.unlimitedUsage}
                          onChange={(e) => updateOverride('unlimitedUsage', e.target.checked)}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="subtitle1">Unlimited Usage</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Bypass storage and generation minute quotas
                          </Typography>
                        </Box>
                      }
                    />
                  </Paper>

                  <Paper sx={{ p: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={overrides.debugMode}
                          onChange={(e) => updateOverride('debugMode', e.target.checked)}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="subtitle1">Debug Mode</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Enable verbose logging and debug information
                          </Typography>
                        </Box>
                      }
                    />
                  </Paper>
                </Stack>

                <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Current Override Status
                  </Typography>
                  <pre style={{ margin: 0, fontSize: 12 }}>
                    {JSON.stringify(overrides, null, 2)}
                  </pre>
                </Box>

                <Button
                  variant="outlined"
                  color="error"
                  sx={{ mt: 2 }}
                  onClick={() => {
                    setOverrides({
                      bypassPermissionChecks: false,
                      mockPaidPlan: false,
                      unlimitedUsage: false,
                      debugMode: false,
                    })
                    localStorage.removeItem('testOverrides')
                    setSuccess('All overrides cleared')
                  }}
                >
                  Clear All Overrides
                </Button>
              </CardContent>
            </Card>
          </TabPanel>

          {/* Cancel Dialog */}
          <Dialog open={isCancelDialogOpen} onClose={() => setIsCancelDialogOpen(false)}>
            <DialogTitle>Cancel Subscription?</DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to cancel your subscription? You will be downgraded to the free plan immediately.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsCancelDialogOpen(false)}>Keep Subscription</Button>
              <Button onClick={handleCancelSubscription} color="error">
                Cancel Subscription
              </Button>
            </DialogActions>
          </Dialog>

          {/* Change Plan Dialog */}
          <Dialog open={isChangePlanDialogOpen} onClose={() => setIsChangePlanDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Change Plan</DialogTitle>
            <DialogContent>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Select Plan</InputLabel>
                <Select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                >
                  {plans.map((plan) => (
                    <MenuItem key={plan.id} value={plan.id}>
                      {plan.name} - ${plan.pricing.monthlyDisplay}/month
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsChangePlanDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleChangePlan} variant="contained" disabled={!selectedPlanId}>
                Change Plan
              </Button>
            </DialogActions>
          </Dialog>
        </Container>
      </Layout>
    </>
  )
}
