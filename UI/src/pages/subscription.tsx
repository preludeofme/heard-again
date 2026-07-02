import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { useState, useEffect, useCallback } from 'react'
import { fetchWithCSRF } from '@/lib/api-client'
import { useRouter } from 'next/router'
import {
  Box, Typography, Card, Button, CircularProgress, Chip, Divider,
  LinearProgress, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material'
import {
  Check, Warning, Cloud, Computer, Storage, Group, RecordVoiceOver,
  ArrowForward, Cancel, Close,
} from '@mui/icons-material'

interface Plan {
  id: string
  name: string
  planType: string
  pricing: {
    monthlyCents: number
    yearlyCents: number | null
    monthlyDisplay: string
    yearlyDisplay: string | null
  }
  entitlements: {
    tunnelEnabled: boolean
    cloudGpuEnabled: boolean
    cloudStorageEnabled: boolean
    generationMinutesIncluded: number
    storageQuotaBytes: number
    memberQuota: number
    voiceProfileQuota: number
  }
  features: {
    prioritySupport: boolean
    advancedAnalytics: boolean
  }
}

interface Subscription {
  id: string
  billingStatus: string
  renewalDate: string | null
  cancelledAt: string | null
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
  usage: {
    generationMinutesUsed: number
    storageBytesUsed: number
    lastBillingResetAt: string
  }
  createdAt: string
  updatedAt: string
}

interface UsageData {
  period: {
    startedAt: string
    renewalDate: string | null
  }
  usage: {
    storage: {
      bytesUsed: number
      bytesQuota: number
      percentUsed: number
      filesCount: number
      formattedUsed: string
      formattedQuota: string
    }
    generation: {
      minutesUsed: number
      minutesQuota: number
      percentUsed: number
      jobsCount: number
    }
    members: {
      count: number
      quota: number
    }
    voiceProfiles: {
      count: number
      quota: number
    }
  }
  features: {
    tunnelEnabled: boolean
    cloudGpuEnabled: boolean
    cloudStorageEnabled: boolean
    prioritySupport: boolean
    advancedAnalytics: boolean
  }
}

export default function SubscriptionPage() {
  const router = useRouter()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [subRes, usageRes] = await Promise.all([
        fetch('/api/billing/subscription'),
        fetch('/api/billing/usage'),
      ])

      const subData = await subRes.json()
      const usageData = await usageRes.json()

      if (subData.success) {
        // API returns flat shape: { id, billingStatus, usage: {...}, plan: {...} }
        setSubscription(subData.data)
        setPlan(subData.data.plan)
      }
      if (usageData.success) {
        setUsage(usageData.data)
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      const res = await fetchWithCSRF('/api/billing/cancel', { method: 'POST', credentials: 'include' })
      if (res.ok) {
        setShowCancelDialog(false)
        fetchData()
      }
    } catch {
      // Silently fail
    } finally {
      setIsCancelling(false)
    }
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

  const isCancelled = subscription?.billingStatus === 'CANCELLED'
  const isFreePlan = plan?.planType === 'FREE'

  return (
    <>
      <Head>
        <title>Subscription - Heard Again</title>
        <meta name="description" content="Manage your Heard Again subscription" />
      </Head>
      <Layout>
        <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4', px: { xs: 3, md: 8 }, py: 8 }}>
          <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ mb: 6 }}>
              <Typography
                variant="h3"
                className="serif-font"
                sx={{ color: '#16334a', fontStyle: 'italic', mb: 1 }}
              >
                Subscription
              </Typography>
              <Typography variant="body1" sx={{ color: '#546669' }}>
                Manage your plan, view usage, and update billing settings.
              </Typography>
            </Box>

            {/* Current Plan Card */}
            <Card sx={{ p: 4, borderRadius: 4, mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="overline" sx={{ color: '#999', letterSpacing: 1 }}>
                    Current Plan
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#16334a', fontWeight: 700, mb: 1 }}>
                    {plan?.name || 'Free Local'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={subscription?.billingStatus || 'ACTIVE'}
                      size="small"
                      sx={{
                        backgroundColor: isCancelled ? '#ffebee' : '#d0e3e6',
                        color: isCancelled ? '#c62828' : '#16334a',
                        textTransform: 'capitalize',
                      }}
                    />
                    {plan?.features.prioritySupport && (
                      <Chip
                        label="Priority Support"
                        size="small"
                        sx={{ backgroundColor: '#e0c29a', color: '#16334a' }}
                      />
                    )}
                  </Box>
                </Box>
                <Button
                  variant="outlined"
                  onClick={() => router.push('/#pricing')}
                  endIcon={<ArrowForward />}
                  sx={{
                    borderColor: '#16334a',
                    color: '#16334a',
                    borderRadius: 3,
                    textTransform: 'none',
                  }}
                >
                  Change Plan
                </Button>
              </Box>

              {subscription?.renewalDate && !isCancelled && (
                <Typography variant="body2" sx={{ color: '#546669', mt: 2 }}>
                  Renews on {new Date(subscription.renewalDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Typography>
              )}

              {isCancelled && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Your subscription has been cancelled. You'll continue to have access until the end of your billing period.
                </Alert>
              )}
            </Card>

            {/* Usage Stats */}
            {usage && (
              <Card sx={{ p: 4, borderRadius: 4, mb: 4 }}>
                <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600, mb: 3 }}>
                  Usage This Period
                </Typography>

                {/* Voice Generation */}
                {usage.usage.generation.minutesQuota > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ color: '#546669' }}>
                        Voice Generation
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#16334a', fontWeight: 500 }}>
                        {usage.usage.generation.minutesUsed.toFixed(1)} / {usage.usage.generation.minutesQuota} min
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(usage.usage.generation.percentUsed, 100)}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#f6f3ee',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: usage.usage.generation.percentUsed > 80 ? '#e53935' : '#16334a',
                          borderRadius: 4,
                        },
                      }}
                    />
                  </Box>
                )}

                {/* Storage */}
                {usage.usage.storage.bytesQuota > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ color: '#546669' }}>
                        Cloud Storage
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#16334a', fontWeight: 500 }}>
                        {usage.usage.storage.formattedUsed} / {usage.usage.storage.formattedQuota}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(usage.usage.storage.percentUsed, 100)}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#f6f3ee',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: usage.usage.storage.percentUsed > 80 ? '#e53935' : '#16334a',
                          borderRadius: 4,
                        },
                      }}
                    />
                  </Box>
                )}

                {/* Members */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ color: '#546669' }}>
                      Family Members
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#16334a', fontWeight: 500 }}>
                      {usage.usage.members.count} / {usage.usage.members.quota}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min((usage.usage.members.count / usage.usage.members.quota) * 100, 100)}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#f6f3ee',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: (usage.usage.members.count / usage.usage.members.quota) > 0.8 ? '#e53935' : '#16334a',
                        borderRadius: 4,
                      },
                    }}
                  />
                </Box>

                {/* Voice Profiles */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ color: '#546669' }}>
                      Voice Profiles
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#16334a', fontWeight: 500 }}>
                      {usage.usage.voiceProfiles.count} / {usage.usage.voiceProfiles.quota}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={usage.usage.voiceProfiles.quota > 0
                      ? Math.min((usage.usage.voiceProfiles.count / usage.usage.voiceProfiles.quota) * 100, 100)
                      : 0}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#f6f3ee',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: usage.usage.voiceProfiles.quota > 0 &&
                          (usage.usage.voiceProfiles.count / usage.usage.voiceProfiles.quota) > 0.8
                          ? '#e53935'
                          : '#16334a',
                        borderRadius: 4,
                      },
                    }}
                  />
                </Box>
              </Card>
            )}

            {/* Features */}
            <Card sx={{ p: 4, borderRadius: 4, mb: 4 }}>
              <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600, mb: 3 }}>
                Plan Features
              </Typography>
              <List dense>
                <FeatureListItem
                  icon={<Computer />}
                  label="Local Self-Hosting"
                  included={true}
                  description="Your data stays on your machine"
                />
                <FeatureListItem
                  icon={<Cloud />}
                  label="Cloud Tunnel"
                  included={usage?.features.tunnelEnabled || false}
                  description="Access from anywhere via heardagain.com"
                />
                <FeatureListItem
                  icon={<Storage />}
                  label="Cloud GPU Compute"
                  included={usage?.features.cloudGpuEnabled || false}
                  description="Generate voices on our servers"
                />
                <FeatureListItem
                  icon={<Group />}
                  label="Priority Support"
                  included={usage?.features.prioritySupport || false}
                  description="Fast responses from our team"
                />
                <FeatureListItem
                  icon={<RecordVoiceOver />}
                  label="Advanced Analytics"
                  included={usage?.features.advancedAnalytics || false}
                  description="Detailed usage insights"
                />
              </List>
            </Card>

            {/* Cancel Subscription */}
            {!isFreePlan && !isCancelled && (
              <Card sx={{ p: 4, borderRadius: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                  <Box>
                    <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600 }}>
                      Cancel Subscription
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#546669' }}>
                      Downgrade to the free plan. You'll keep access until the end of your billing period.
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Cancel />}
                    onClick={() => setShowCancelDialog(true)}
                    sx={{ borderRadius: 3, textTransform: 'none' }}
                  >
                    Cancel Plan
                  </Button>
                </Box>
              </Card>
            )}
          </Box>
        </Box>

        {/* Cancel Confirmation Dialog */}
        <Dialog
          open={showCancelDialog}
          onClose={() => setShowCancelDialog(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 4 } }}
        >
          <DialogTitle sx={{ color: '#16334a', fontWeight: 600 }}>
            Cancel your subscription?
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ color: '#546669', mb: 2 }}>
              Are you sure you want to cancel your {plan?.name} subscription?
            </Typography>
            <Typography variant="body2" sx={{ color: '#999' }}>
              • You'll be downgraded to the Free Local plan<br />
              • You'll keep access until {subscription?.renewalDate
                ? new Date(subscription.renewalDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'the end of your billing period'}<br />
              • Cloud features will be disabled after that date<br />
              • Your data will remain accessible locally
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button
              onClick={() => setShowCancelDialog(false)}
              sx={{ color: '#546669' }}
            >
              Keep Subscription
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleCancel}
              disabled={isCancelling}
              sx={{ borderRadius: 3 }}
            >
              {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
            </Button>
          </DialogActions>
        </Dialog>
      </Layout>
    </>
  )
}

function FeatureListItem({
  icon,
  label,
  included,
  description,
}: {
  icon: React.ReactNode
  label: string
  included: boolean
  description: string
}) {
  return (
    <ListItem sx={{ px: 0 }}>
      <ListItemIcon sx={{ minWidth: 40, color: included ? '#16334a' : '#ccc' }}>
        {included ? icon : <Close />}
      </ListItemIcon>
      <ListItemText
        primary={
          <Typography
            variant="body1"
            sx={{
              color: included ? '#16334a' : '#999',
              textDecoration: included ? 'none' : 'line-through',
            }}
          >
            {label}
          </Typography>
        }
        secondary={
          <Typography variant="body2" sx={{ color: included ? '#546669' : '#bbb' }}>
            {description}
          </Typography>
        }
      />
    </ListItem>
  )
}


export async function getServerSideProps() { return { props: {} } }
