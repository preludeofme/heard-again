import Head from 'next/head'
import { useEffect, useState } from 'react'
import { fetchWithCSRF } from '@/lib/api-client'
import { useRouter } from 'next/router'
import {
  Alert,
  Avatar,
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
  Grid,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
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
  ArrowForward,
  Check,
  Warning,
  Refresh,
  Storage,
  RecordVoiceOver,
  Group,
  Security as SecurityIcon,
} from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'
import { SecuritySettings } from '@/components/account/SecuritySettings'

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
  const [familyspaceRole, setFamilyspaceRole] = useState<string>('VIEWER')

  // Familyspace data
  const [familyspace, setFamilyspace] = useState<any | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [isEditingFamilyspace, setIsEditingFamilyspace] = useState(false)
  const [editFamilyspaceName, setEditFamilyspaceName] = useState('')

  // Subscription data
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [isChangePlanDialogOpen, setIsChangePlanDialogOpen] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')

  // Instance/Tunnel data
  const [instance, setInstance] = useState<Instance | null>(null)
  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus | null>(null)

  // Load all data
  useEffect(() => {
    loadData()
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
      let currentFamilyspaceId = ''
      if (instanceData.success) {
        setInstance(instanceData.data.instance || null)
        setTunnelStatus(instanceData.data.tunnel || null)
        setFamilyspaceRole(instanceData.data.familyspaceRole || 'MEMBER')
        currentFamilyspaceId = instanceData.data.familyspaceId
      }

      // Get familyspace details
      if (currentFamilyspaceId) {
        const fsRes = await fetch(`/api/familyspaces/${currentFamilyspaceId}`, { credentials: 'include' })
        const fsData = await fsRes.json()
        if (fsData.success) {
          setFamilyspace(fsData.data)
          setEditFamilyspaceName(fsData.data.name)
        }

        const membersRes = await fetch(`/api/familyspaces/${currentFamilyspaceId}/members`, { credentials: 'include' })
        const membersData = await membersRes.json()
        if (membersData.success) {
          setMembers(membersData.data)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load account data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    try {
      const res = await fetchWithCSRF('/api/billing/cancel', { method: 'POST', credentials: 'include' })
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
      const res = await fetchWithCSRF('/api/billing/subscribe', {
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
      const res = await fetchWithCSRF('/api/instance/tunnel', {
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

  const handleSaveFamilyspace = async () => {
    if (!editFamilyspaceName.trim() || !familyspace) return
    try {
      const res = await fetchWithCSRF(`/api/familyspaces/${familyspace.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editFamilyspaceName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update familyspace')
      setSuccess('Familyspace updated successfully')
      setIsEditingFamilyspace(false)
      await loadData()
    } catch (err: any) {
      setError(err.message)
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
            <Tabs 
              value={activeTab} 
              onChange={(_, v) => setActiveTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
            >
              <Tab icon={<Person />} label="Profile" />
              <Tab icon={<SecurityIcon />} label="Security" />
              <Tab icon={<Group />} label="Familyspace" />
              <Tab icon={<CreditCard />} label="Subscription" />
              {/* <Tab icon={<Cloud />} label="Instance & Tunnel" /> */}
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
                      label="Familyspace Role"
                      value={familyspaceRole}
                      disabled
                      helperText="Your role in the current familyspace"
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

          {/* Security Tab */}
          <TabPanel value={activeTab} index={1}>
            <SecuritySettings />
          </TabPanel>

          {/* Familyspace Tab */}
          <TabPanel value={activeTab} index={2}>
            <Stack spacing={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3 }}>
                    Familyspace Details
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                      Familyspace Name
                    </Typography>
                    {isEditingFamilyspace ? (
                      <Stack direction="row" spacing={1}>
                        <TextField
                          fullWidth
                          size="small"
                          value={editFamilyspaceName}
                          onChange={(e) => setEditFamilyspaceName(e.target.value)}
                          autoFocus
                        />
                        <Button variant="contained" size="small" onClick={handleSaveFamilyspace}>
                          Save
                        </Button>
                        <Button variant="outlined" size="small" onClick={() => setIsEditingFamilyspace(false)}>
                          Cancel
                        </Button>
                      </Stack>
                    ) : (
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {familyspace?.name || 'Loading...'}
                        </Typography>
                        {(familyspaceRole === 'OWNER' || familyspaceRole === 'ADMIN') && (
                          <Button size="small" onClick={() => setIsEditingFamilyspace(true)}>
                            Edit
                          </Button>
                        )}
                      </Stack>
                    )}
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                      Slug
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {familyspace?.slug || '...'}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Members
                  </Typography>
                  <List>
                    {members.map((member) => (
                      <ListItem key={member.id}>
                        <ListItemAvatar>
                          <Avatar src={member.avatarUrl || undefined}>
                            {member.displayName?.[0] || member.email[0]}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={member.displayName || member.email}
                          secondary={member.role}
                        />
                        {member.role === 'OWNER' && <Chip size="small" label="Owner" />}
                      </ListItem>
                    ))}
                  </List>
                  <Button 
                    variant="outlined" 
                    fullWidth 
                    sx={{ mt: 2 }}
                    onClick={() => router.push(`/familyspaces/${familyspace?.id}/settings`)}
                  >
                    Manage All Settings & Invitations
                  </Button>
                </CardContent>
              </Card>
            </Stack>
          </TabPanel>

          {/* Subscription Tab */}
          <TabPanel value={activeTab} index={3}>
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
                        onClick={() => setActiveTab(3)}
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
          {/* 
          <TabPanel value={activeTab} index={3}>
            <Stack spacing={3}>
...
              </Card>
            </Stack>
          </TabPanel>
          */}

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


export async function getServerSideProps() { return { props: {} } }
