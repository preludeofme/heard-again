import Head from 'next/head'
import { Layout } from '@/components/Layout'
import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Card, Grid, Button, Chip, CircularProgress,
  ToggleButton, ToggleButtonGroup, Divider,
} from '@mui/material'
import {
  Check, Close, Cloud, Computer, Storage, Support,
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
  planId: string
  billingStatus: string
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [plansRes, subRes] = await Promise.all([
        fetch('/api/billing/plans'),
        fetch('/api/billing/subscription'),
      ])

      const plansData = await plansRes.json()
      const subData = await subRes.json()

      if (plansData.success) {
        setPlans(plansData.data.plans)
      }
      if (subData.success) {
        setSubscription(subData.data.subscription)
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

  const handleSubscribe = async (planId: string) => {
    setSubscribingPlanId(planId)
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingCycle }),
      })

      if (res.ok) {
        fetchData()
      }
    } catch {
      // Silently fail
    } finally {
      setSubscribingPlanId(null)
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

  return (
    <>
      <Head>
        <title>Pricing - Heard Again</title>
        <meta name="description" content="Choose the right plan for your family archive" />
      </Head>
      <Layout>
        <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4', px: { xs: 3, md: 8 }, py: 8 }}>
          {/* Header */}
          <Box sx={{ maxWidth: 1200, mx: 'auto', textAlign: 'center', mb: 8 }}>
            <Typography
              variant="h2"
              className="serif-font"
              sx={{ color: '#16334a', fontStyle: 'italic', mb: 2 }}
            >
              Simple, transparent pricing
            </Typography>
            <Typography variant="h6" sx={{ color: '#546669', maxWidth: 600, mx: 'auto' }}>
              Choose the plan that fits your family's needs. All plans include core features.
            </Typography>
          </Box>

          {/* Billing Toggle */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
            <ToggleButtonGroup
              value={billingCycle}
              exclusive
              onChange={(e, value) => value && setBillingCycle(value)}
              sx={{
                backgroundColor: '#f6f3ee',
                borderRadius: 3,
                p: 0.5,
              }}
            >
              <ToggleButton
                value="monthly"
                sx={{
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  textTransform: 'none',
                  border: 'none',
                  '&.Mui-selected': {
                    backgroundColor: '#16334a',
                    color: 'white',
                  },
                }}
              >
                Monthly
              </ToggleButton>
              <ToggleButton
                value="yearly"
                sx={{
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  textTransform: 'none',
                  border: 'none',
                  '&.Mui-selected': {
                    backgroundColor: '#16334a',
                    color: 'white',
                  },
                }}
              >
                Yearly
                <Chip
                  label="Save 17%"
                  size="small"
                  sx={{
                    ml: 1,
                    backgroundColor: billingCycle === 'yearly' ? 'rgba(255,255,255,0.2)' : '#e0c29a',
                    color: billingCycle === 'yearly' ? 'white' : '#16334a',
                    fontSize: '0.7rem',
                  }}
                />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Plans Grid */}
          <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
            <Grid container spacing={3} alignItems="stretch">
              {plans.map((plan) => {
                const isCurrentPlan = subscription?.planId === plan.id
                const price = billingCycle === 'monthly'
                  ? plan.pricing.monthlyCents
                  : (plan.pricing.yearlyCents || plan.pricing.monthlyCents * 12)
                const priceDisplay = (price / 100).toFixed(2)

                return (
                  <Grid key={plan.id} size={{ xs: 12, md: 6, lg: 3 }}>
                    <Card
                      sx={{
                        p: 4,
                        borderRadius: 4,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        ...(isCurrentPlan && {
                          boxShadow: '0 0 0 2px #16334a',
                        }),
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: isCurrentPlan
                            ? '0 0 0 2px #16334a, 0 12px 40px rgba(0,0,0,0.08)'
                            : '0 12px 40px rgba(0,0,0,0.08)',
                        },
                      }}
                    >
                      {/* Current Plan Badge */}
                      {isCurrentPlan && (
                        <Chip
                          label="Current Plan"
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            backgroundColor: '#16334a',
                            color: 'white',
                          }}
                        />
                      )}

                      {/* Plan Header */}
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="overline" sx={{ color: '#999', letterSpacing: 1 }}>
                          {plan.planType}
                        </Typography>
                        <Typography variant="h4" sx={{ color: '#16334a', fontWeight: 700, mb: 1 }}>
                          {plan.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                          <Typography variant="h3" sx={{ color: '#16334a', fontWeight: 700 }}>
                            ${priceDisplay}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#999' }}>
                            /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                          </Typography>
                        </Box>
                      </Box>

                      <Divider sx={{ my: 2, opacity: 0.3 }} />

                      {/* Features */}
                      <Box sx={{ flexGrow: 1, mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ color: '#546669', mb: 2 }}>
                          Includes:
                        </Typography>

                        <FeatureRow
                          icon={<Computer fontSize="small" />}
                          label="Self-hosted"
                          included={plan.planType === 'FREE'}
                        />
                        <FeatureRow
                          icon={<Cloud fontSize="small" />}
                          label="Cloud tunnel access"
                          included={plan.entitlements.tunnelEnabled}
                        />
                        <FeatureRow
                          icon={<Storage fontSize="small" />}
                          label="Cloud GPU compute"
                          included={plan.entitlements.cloudGpuEnabled}
                        />
                        <FeatureRow
                          icon={<Support fontSize="small" />}
                          label="Priority support"
                          included={plan.features.prioritySupport}
                        />

                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" sx={{ color: '#546669' }}>
                            • {plan.entitlements.generationMinutesIncluded} voice generation min/mo
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#546669' }}>
                            • {plan.entitlements.memberQuota} family members
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#546669' }}>
                            • {plan.entitlements.voiceProfileQuota} voice profiles
                          </Typography>
                          {plan.entitlements.storageQuotaBytes > 0 && (
                            <Typography variant="body2" sx={{ color: '#546669' }}>
                              • {(plan.entitlements.storageQuotaBytes / (1024 * 1024 * 1024)).toFixed(0)}GB cloud storage
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      {/* CTA */}
                      <Button
                        variant={isCurrentPlan ? 'outlined' : 'contained'}
                        fullWidth
                        disabled={isCurrentPlan || subscribingPlanId === plan.id}
                        onClick={() => handleSubscribe(plan.id)}
                        sx={{
                          py: 1.5,
                          borderRadius: 3,
                          textTransform: 'none',
                          fontSize: '1rem',
                          ...(isCurrentPlan && {
                            borderColor: '#16334a',
                            color: '#16334a',
                          }),
                          ...(!isCurrentPlan && {
                            backgroundColor: '#16334a',
                            '&:hover': { backgroundColor: '#2e4a62' },
                          }),
                        }}
                      >
                        {subscribingPlanId === plan.id ? (
                          <CircularProgress size={20} sx={{ color: 'inherit' }} />
                        ) : isCurrentPlan ? (
                          'Current Plan'
                        ) : (
                          'Subscribe'
                        )}
                      </Button>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          </Box>

          {/* FAQ or Additional Info */}
          <Box sx={{ maxWidth: 800, mx: 'auto', mt: 8, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#999' }}>
              All plans support unlimited stories and memories. Voice generation usage resets monthly.
              Questions? Contact support@heardagain.com
            </Typography>
          </Box>
        </Box>
      </Layout>
    </>
  )
}

function FeatureRow({ icon, label, included }: { icon: React.ReactNode; label: string; included: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      <Box
        sx={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: included ? '#d0e3e6' : '#f6f3ee',
          color: included ? '#16334a' : '#999',
        }}
      >
        {included ? <Check sx={{ fontSize: 14 }} /> : <Close sx={{ fontSize: 14 }} />}
      </Box>
      <Typography
        variant="body2"
        sx={{
          color: included ? '#546669' : '#999',
          textDecoration: included ? 'none' : 'line-through',
        }}
      >
        {label}
      </Typography>
    </Box>
  )
}
