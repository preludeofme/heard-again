import React from 'react'
import { Box, Typography, Card, Grid, Button, Chip, Divider } from '@mui/material'
import { Check, Close, Cloud, Computer, Storage, Support } from '@mui/icons-material'
import Link from 'next/link'

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

export function LandingPricingSection() {
  const staticPlans = [
    {
      id: 'free',
      name: 'Self-Hosted',
      planType: 'FREE',
      subtitle: 'For families who want full ownership and control.',
      pricing: { monthlyDisplay: '0.00' },
      features: [
        'Open-source self-hosting',
        'Unlimited family members',
        'Unlimited stories and memories',
        'Unlimited voice profiles, based on your own hardware',
        'Full control of your family data',
        'No required cloud storage'
      ],
      bestFor: 'Best for families who are comfortable running their own software or want a private family memories at home.',
      isCloud: false
    },
    {
      id: 'cloud_min',
      name: 'Cloud Access — Starter',
      planType: 'CLOUD',
      subtitle: 'For families who want a simple hosted option.',
      pricing: { monthlyDisplay: '9.99' },
      features: [
        'Private cloud hosting',
        '30 minutes of voice generation per month',
        'Unlimited family members',
        'Up to 50 voice profiles',
        'Secure memory storage',
        'Managed updates',
        'No selling of your data, ever'
      ],
      bestFor: 'Best for families just beginning to preserve their stories.',
      isCloud: true
    },
    {
      id: 'cloud_mid',
      name: 'Cloud Access — Family',
      planType: 'CLOUD',
      subtitle: 'For families actively building their legacy library.',
      pricing: { monthlyDisplay: '19.99' },
      features: [
        'Private cloud hosting',
        '60 minutes of voice generation per month',
        'Unlimited family members',
        'Up to 50 voice profiles',
        'Secure memory storage',
        'Managed updates',
        'Priority processing'
      ],
      bestFor: 'Best for families collecting stories from multiple relatives and contributors.',
      isCloud: true
    },
    {
      id: 'cloud_max',
      name: 'Cloud Access — Legacy',
      planType: 'CLOUD',
      subtitle: 'For families preserving a large collection of voices, memories, and stories.',
      pricing: { monthlyDisplay: '39.99' },
      features: [
        'Private cloud hosting',
        'Unlimited voice generation',
        'Unlimited family members',
        'Up to 50 voice profiles',
        'Secure memory storage',
        'Managed updates',
        'Priority support'
      ],
      bestFor: 'Best for families building a long-term family legacy library.',
      isCloud: true
    }
  ]

  return (
    <Box component="section" sx={{ py: 16, px: { xs: 4, md: 8 }, bgcolor: '#fcf9f4' }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', textAlign: 'center', mb: 8 }}>
        <Typography variant="h2" sx={{ color: '#16334a', fontFamily: 'var(--font-newsreader), serif', mb: 2 }}>
          Simple, Transparent Pricing
        </Typography>
        <Typography variant="h6" sx={{ color: '#546669', maxWidth: 800, mx: 'auto' }}>
          Choose the option that fits your family. Whether you want to manage everything yourself or let us host it securely for you, Heard Again is designed to give your family control.
        </Typography>
      </Box>

      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Grid container spacing={4} justifyContent="center">
          {staticPlans.map((plan) => (
            <Grid key={plan.id} size={{ xs: 12, md: 6, lg: 3 }}>
              <Card sx={{ p: 4, borderRadius: 4, height: '100%', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 40px rgba(0,0,0,0.08)' } }}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="overline" sx={{ color: '#999', letterSpacing: 1, display: 'block', mb: 1 }}>{plan.planType}</Typography>
                  <Typography variant="h4" sx={{ color: '#16334a', fontWeight: 700, mb: 1, fontSize: '1.5rem', minHeight: 64 }}>{plan.name}</Typography>
                  <Typography variant="body2" sx={{ color: '#546669', mb: 2, minHeight: 40 }}>{plan.subtitle}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                    <Typography variant="h3" sx={{ color: '#16334a', fontWeight: 700 }}>${plan.pricing.monthlyDisplay}</Typography>
                    <Typography variant="body2" sx={{ color: '#999' }}>/mo</Typography>
                  </Box>
                </Box>
                <Divider sx={{ my: 2, opacity: 0.3 }} />
                <Box sx={{ flexGrow: 1, mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ color: '#546669', mb: 2 }}>Includes:</Typography>
                  <Box sx={{ mt: 2 }}>
                    {plan.features.map((feature, i) => (
                      <FeatureRow key={i} icon={<Check fontSize="small" />} label={feature} included={true} />
                    ))}
                  </Box>
                  <Typography variant="body2" sx={{ color: '#16334a', fontStyle: 'italic', mt: 3, p: 2, bgcolor: '#f6f3ee', borderRadius: 2 }}>
                    {plan.bestFor}
                  </Typography>
                </Box>
                <Button component={Link} href="/signup" variant={plan.isCloud ? 'contained' : 'outlined'} fullWidth sx={{ py: 1.5, borderRadius: 3, textTransform: 'none', fontSize: '1rem', ...(plan.isCloud ? { backgroundColor: '#16334a', '&:hover': { backgroundColor: '#2e4a62' } } : { borderColor: '#16334a', color: '#16334a' }) }}>
                  Get Started
                </Button>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  )
}
