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
  Checkbox,
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
  loginProvider?: string | null
}

interface Plan {
  id: string
  slug: string | null
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
  cancelAtPeriodEnd: boolean
  stripeSubscriptionId: string | null
  usage: {
    generationMinutesUsed: number
    storageBytesUsed: number
    lastBillingResetAt: string
  }
  plan: Plan | null
}

interface Refund {
  id: string
  amountCents: number
  currency: string
  reason: string | null
  status: string
  createdAt: string
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
  const [cancelImmediately, setCancelImmediately] = useState(false)
  const [isChangePlanDialogOpen, setIsChangePlanDialogOpen] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')

  // Refunds (owner/admin only)
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')

  // Deep-link support: /account?tab=security&pendingPlan=cloud_mid (onboarding
  // redirects here when a brand-new owner picks a paid plan before MFA is set up)
  const pendingPlan = typeof router.query.pendingPlan === 'string' ? router.query.pendingPlan : null

  useEffect(() => {
    const tabParam = router.query.tab
    if (typeof tabParam !== 'string') return
    const tabIndex: Record<string, number> = {
      profile: 0,
      security: 1,
      familyspace: 2,
      subscription: 3,
    }
    if (tabParam in tabIndex) {
      if (tabParam === 'security' && user?.loginProvider === 'google') {
        setActiveTab(0)
        return
      }
      setActiveTab(tabIndex[tabParam])
    }
  }, [router.query.tab, user?.loginProvider])

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
      let currentRole = 'MEMBER'
      if (instanceData.success) {
        setInstance(instanceData.data.instance || null)
        setTunnelStatus(instanceData.data.tunnel || null)
        currentRole = instanceData.data.familyspaceRole || 'MEMBER'
        setFamilyspaceRole(currentRole)
        currentFamilyspaceId = instanceData.data.familyspaceId
      }

      // Refund history is owner/admin only
      if (currentRole === 'OWNER' || currentRole === 'ADMIN') {
        try {
          const refundsRes = await fetch('/api/billing/refund', { credentials: 'include' })
          const refundsData = await refundsRes.json()
          if (refundsData.success) {
            setRefunds(refundsData.data.refunds)
          }
        } catch {
          // Refund history is non-critical
        }
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
      const res = await fetchWithCSRF('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ immediate: cancelImmediately }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to cancel')
      setSuccess(data.data?.message || 'Subscription cancelled successfully')
      setIsCancelDialogOpen(false)
      setCancelImmediately(false)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleResumeSubscription = async () => {
    try {
      const res = await fetchWithCSRF('/api/billing/resume', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to resume subscription')
      setSuccess(data.data?.message || 'Subscription resumed')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleRequestRefund = async () => {
    try {
      const amountCents = refundAmount ? Math.round(parseFloat(refundAmount) * 100) : undefined
      const res = await fetchWithCSRF('/api/billing/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(amountCents ? { amountCents } : {}),
          ...(refundReason ? { reason: refundReason } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit refund')
      setSuccess(data.data?.message || 'Refund submitted')
      setIsRefundDialogOpen(false)
      setRefundAmount('')
      setRefundReason('')
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
      if (data.data?.checkoutUrl) {
        window.location.href = data.data.checkoutUrl
        return
      }
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
              <Tab 
                icon={<SecurityIcon />} 
                label="Security" 
                style={user?.loginProvider === 'google' ? { display: 'none' } : undefined} 
              />
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
          {user?.loginProvider !== 'google' && (
            <TabPanel value={activeTab} index={1}>
              {pendingPlan && (
                <Alert severity="info" sx={{ mb: 3 }}>
                  Almost there — familyspace owners need two-factor security set up before
                  subscribing. Set it up below, then head to the{' '}
                  <Button
                    size="small"
                    onClick={() => {
                      setActiveTab(3)
                      const matchedPlan = plans.find((p) => p.slug === pendingPlan)
                      setSelectedPlanId(matchedPlan?.id || pendingPlan)
                      setIsChangePlanDialogOpen(true)
                    }}
                    sx={{ verticalAlign: 'baseline', textTransform: 'none', p: 0, minWidth: 0 }}
                  >
                    Subscription tab
                  </Button>{' '}
                  to finish subscribing to your selected plan.
                </Alert>
              )}
              <SecuritySettings />
            </TabPanel>
          )}

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
                    {subscription?.cancelAtPeriodEnd ? (
                      <Chip label="Cancels at period end" color="warning" />
                    ) : (
                      <Chip
                        label={subscription?.billingStatus || 'NO SUBSCRIPTION'}
                        color={subscription?.billingStatus === 'ACTIVE' ? 'success' : 'default'}
                      />
                    )}
                  </Box>

                  {subscription?.plan ? (
                    <>
                      <Typography variant="h4" sx={{ color: '#16334a', mb: 1 }}>
                        {subscription.plan.name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#6f7c7f', mb: 3 }}>
                        ${subscription.plan.pricing.monthlyDisplay}/month
                        {subscription.renewalDate && (
                          <>
                            {' · '}
                            {subscription.cancelAtPeriodEnd ? 'Cancels on ' : 'Renews on '}
                            {new Date(subscription.renewalDate).toLocaleDateString()}
                          </>
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
                          onClick={() => {
                            const defaultSelect = plans.find(p => p.id !== subscription?.plan?.id)?.id || ''
                            setSelectedPlanId(defaultSelect)
                            setIsChangePlanDialogOpen(true)
                          }}
                        >
                          Change Plan
                        </Button>
                        {subscription.plan.planType !== 'FREE' && (
                          subscription.cancelAtPeriodEnd ? (
                            <Button
                              variant="outlined"
                              color="success"
                              onClick={handleResumeSubscription}
                            >
                              Resume Subscription
                            </Button>
                          ) : (
                            <Button
                              variant="outlined"
                              color="error"
                              onClick={() => setIsCancelDialogOpen(true)}
                            >
                              Cancel Subscription
                            </Button>
                          )
                        )}
                      </Stack>
                    </>
                  ) : (
                    <>
                      <Alert severity="info" sx={{ mb: 3 }}>
                        You don&apos;t have an active subscription. Subscribe to a plan to unlock premium features.
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

              {/* Refunds — owner/admin only */}
              {(familyspaceRole === 'OWNER' || familyspaceRole === 'ADMIN') && (
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Refunds</Typography>
                      {subscription?.plan && subscription.plan.planType !== 'FREE' && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={() => setIsRefundDialogOpen(true)}
                        >
                          Request Refund
                        </Button>
                      )}
                    </Box>
                    {refunds.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No refunds have been issued for this familyspace.
                      </Typography>
                    ) : (
                      <List>
                        {refunds.map((refund) => (
                          <ListItem key={refund.id}>
                            <ListItemText
                              primary={`$${(refund.amountCents / 100).toFixed(2)} ${refund.currency.toUpperCase()}`}
                              secondary={`${new Date(refund.createdAt).toLocaleDateString()}${refund.reason ? ` · ${refund.reason}` : ''}`}
                            />
                            <Chip
                              size="small"
                              label={refund.status}
                              color={
                                refund.status === 'SUCCEEDED' ? 'success'
                                  : refund.status === 'FAILED' ? 'error'
                                  : refund.status === 'CANCELED' ? 'default'
                                  : 'warning'
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </CardContent>
                </Card>
              )}
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
          <Dialog
            open={isCancelDialogOpen}
            onClose={() => {
              setIsCancelDialogOpen(false)
              setCancelImmediately(false)
            }}
          >
            <DialogTitle>Cancel Subscription?</DialogTitle>
            <DialogContent>
              <Typography sx={{ mb: 2 }}>
                {cancelImmediately
                  ? 'Your subscription will be cancelled and downgraded to the free plan immediately.'
                  : "Your subscription will remain active until the end of your current billing period, then downgrade to the free plan. You won't be charged again."}
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={cancelImmediately}
                    onChange={(e) => setCancelImmediately(e.target.checked)}
                  />
                }
                label="Cancel immediately instead (skips remaining paid access)"
              />
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setIsCancelDialogOpen(false)
                  setCancelImmediately(false)
                }}
              >
                Keep Subscription
              </Button>
              <Button onClick={handleCancelSubscription} color="error">
                Cancel Subscription
              </Button>
            </DialogActions>
          </Dialog>

          {/* Refund Dialog — owner/admin only */}
          <Dialog open={isRefundDialogOpen} onClose={() => setIsRefundDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Request Refund</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Leave the amount blank to refund the full latest payment.
              </Typography>
              <TextField
                fullWidth
                label="Amount (USD, optional)"
                type="number"
                placeholder="e.g. 9.99"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                sx={{ mb: 2 }}
                inputProps={{ min: 0, step: 0.01 }}
              />
              <TextField
                fullWidth
                label="Reason (optional)"
                placeholder="e.g. requested_by_customer"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsRefundDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleRequestRefund} color="error" variant="contained">
                Submit Refund
              </Button>
            </DialogActions>
          </Dialog>

          {/* Change Plan Dialog */}
          <Dialog open={isChangePlanDialogOpen} onClose={() => setIsChangePlanDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ pb: 1, fontWeight: 700, color: '#16334a' }}>Confirm Plan Change</DialogTitle>
            <DialogContent>
              {(() => {
                const targetPlan = plans.find((p) => p.id === selectedPlanId)
                if (!targetPlan) {
                  return (
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
                  )
                }

                const currentPlan = subscription?.plan
                const currentCents = currentPlan?.pricing?.monthlyCents || 0
                const targetCents = targetPlan.pricing.monthlyCents
                const deltaCents = targetCents - currentCents
                let deltaText = ''
                if (deltaCents > 0) {
                  deltaText = `(+$${(deltaCents / 100).toFixed(2)}/month)`
                } else if (deltaCents < 0) {
                  deltaText = `(-$${(Math.abs(deltaCents) / 100).toFixed(2)}/month)`
                } else {
                  deltaText = '(No price change)'
                }

                return (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body1" sx={{ mb: 3 }}>
                      You are switching to the <strong>{targetPlan.name}</strong> plan. Please review the changes below.
                    </Typography>

                    {/* Cost Perspective */}
                    <Box sx={{ mb: 3, p: 2, bgcolor: '#f6f3ee', borderRadius: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#16334a' }}>
                        Cost Comparison
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Current Price</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {currentPlan ? `$${currentPlan.pricing.monthlyDisplay}/month` : '$0.00 (Free)'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">New Price</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#16334a' }}>
                            ${targetPlan.pricing.monthlyDisplay}/month <span style={{ fontSize: '0.8rem', fontWeight: 500, display: 'block', marginTop: '2px' }}>{deltaText}</span>
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>

                    {/* Features Perspective */}
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#16334a' }}>
                      Feature Changes
                    </Typography>
                    <Stack spacing={1.5} sx={{ mt: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.06)', pb: 1 }}>
                        <Typography variant="body2" color="text.secondary">Generation Minutes</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {currentPlan ? `${currentPlan.entitlements.generationMinutesIncluded} min` : '0 min'} ➜ <span style={{ color: '#16334a' }}>{targetPlan.entitlements.generationMinutesIncluded} min</span>
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.06)', pb: 1 }}>
                        <Typography variant="body2" color="text.secondary">Storage Space</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {currentPlan ? formatBytes(currentPlan.entitlements.storageQuotaBytes) : '0 B'} ➜ <span style={{ color: '#16334a' }}>{formatBytes(targetPlan.entitlements.storageQuotaBytes)}</span>
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.06)', pb: 1 }}>
                        <Typography variant="body2" color="text.secondary">Member Limit</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {currentPlan ? `${currentPlan.entitlements.memberQuota} members` : '0 members'} ➜ <span style={{ color: '#16334a' }}>{targetPlan.entitlements.memberQuota} members</span>
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', pb: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">Cloud GPU Access</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {currentPlan?.entitlements?.cloudGpuEnabled ? 'Yes' : 'No'} ➜ <span style={{ color: '#16334a' }}>{targetPlan.entitlements.cloudGpuEnabled ? 'Yes' : 'No'}</span>
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                )
              })()}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setIsChangePlanDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleChangePlan} variant="contained" disabled={!selectedPlanId} sx={{ bgcolor: '#16334a', '&:hover': { bgcolor: '#2e4a62' } }}>
                Confirm Change
              </Button>
            </DialogActions>
          </Dialog>
        </Container>
      </Layout>
    </>
  )
}


export async function getServerSideProps() { return { props: {} } }
