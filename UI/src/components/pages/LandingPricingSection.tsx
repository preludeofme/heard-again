import React from 'react'
import { Box, Typography, Card, Grid, Button, Chip, Divider } from '@mui/material'
import { Check, Close } from '@mui/icons-material'
import Link from 'next/link'

function FeatureRow({
  icon,
  label,
  included,
  strikeThrough = true,
  warning = false,
}: {
  icon: React.ReactNode
  label: React.ReactNode
  included: boolean
  strikeThrough?: boolean
  warning?: boolean
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
      <Box
        sx={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: included ? '#d0e3e6' : warning ? '#fae8e8' : '#f6f3ee',
          color: included ? '#16334a' : warning ? '#c0392b' : '#999',
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {included ? <Check sx={{ fontSize: 12 }} /> : <Close sx={{ fontSize: 12 }} />}
      </Box>
      <Typography
        variant="body2"
        sx={{
          color: included ? '#546669' : warning ? '#7f8c8d' : '#999',
          textDecoration: !included && strikeThrough ? 'line-through' : 'none',
          fontSize: '0.9rem',
          lineHeight: 1.3,
        }}
      >
        {label}
      </Typography>
    </Box>
  )
}

export function LandingPricingSection() {
  const cloudPlans = [
    {
      id: 'cloud_min',
      name: 'Cloud Access — Starter',
      planType: 'CLOUD',
      subtitle: 'For families who want a simple, secure hosted option.',
      pricing: { monthlyDisplay: '9.99' },
      features: [
        <strong>No setup required</strong>,
        <strong>Secure managed hosting</strong>,
        <strong>Automatic backups & updates</strong>,
        <span>
          <strong>30 minutes</strong> of voice generation / mo
        </span>,
        <span>
          Up to <strong>50 voice profiles</strong>
        </span>,
        'Easy family sharing',
        'Consent and privacy tools',
        'Support included',
      ],
      bestFor: 'Best for families just beginning to preserve their stories.',
      isRecommended: false,
      ctaText: 'Start free trial',
    },
    {
      id: 'cloud_mid',
      name: 'Cloud Access — Family',
      planType: 'CLOUD',
      subtitle: 'For families actively building their legacy library.',
      pricing: { monthlyDisplay: '19.99' },
      features: [
        <span key="bold-plus" style={{ color: '#16334a', fontWeight: 600 }}>
          Includes all Starter features PLUS:
        </span>,
        <span>
          <strong>60 minutes</strong> of voice generation / mo
        </span>,
        <strong>Priority voice processing</strong>,
        'Advanced family tree linking',
        <strong>Priority support response</strong>,
        'Easy family sharing',
      ],
      bestFor: 'Best for families collecting stories from multiple relatives and contributors.',
      isRecommended: true,
      ctaText: 'Start free trial',
    },
    {
      id: 'cloud_max',
      name: 'Cloud Access — Legacy',
      planType: 'CLOUD',
      subtitle: 'For families preserving a large collection of voices, memories, and stories.',
      pricing: { monthlyDisplay: '39.99' },
      features: [
        <span key="bold-plus" style={{ color: '#16334a', fontWeight: 600 }}>
          Includes all Family features PLUS:
        </span>,
        <strong>Unlimited voice generation</strong>,
        <strong>Priority support response</strong>,
        <strong>Dedicated success manager</strong>,
      ],
      bestFor: 'Best for families building a long-term family legacy library.',
      isRecommended: false,
      ctaText: 'Choose Legacy',
    },
  ]

  return (
    <Box id="pricing" component="section" sx={{ py: 16, px: { xs: 4, md: 8 }, bgcolor: '#fcf9f4' }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', textAlign: 'center', mb: 8 }}>
        <Typography
          variant="h2"
          sx={{ color: '#16334a', fontFamily: 'var(--font-newsreader), serif', mb: 2 }}
        >
          Simple, transparent pricing
        </Typography>
        <Typography variant="h6" sx={{ color: '#546669', maxWidth: 800, mx: 'auto' }}>
          Choose a managed cloud plan for the easiest experience, or self-host Heard Again yourself
          if you prefer full technical control.
        </Typography>
      </Box>

      {/* Main Pricing Cards Grid */}
      <Box sx={{ maxWidth: 1200, mx: 'auto', mb: 8 }}>
        <Grid container spacing={4} justifyContent="center" alignItems="stretch">
          {cloudPlans.map((plan) => (
            <Grid key={plan.id} size={{ xs: 12, md: 6, lg: 4 }}>
              <Card
                sx={{
                  p: 4,
                  borderRadius: 4,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'visible',
                  transition: 'transform 0.2s',
                  border: plan.isRecommended ? '2.5px solid #16334a' : '1px solid rgba(0,0,0,0.05)',
                  boxShadow: plan.isRecommended
                    ? '0 8px 30px rgba(22, 51, 74, 0.08)'
                    : '0 4px 20px rgba(0,0,0,0.02)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
                  },
                }}
              >
                {plan.isRecommended && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -14,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      bgcolor: '#16334a',
                      color: '#fcf9f4',
                      px: 2.5,
                      py: 0.75,
                      borderRadius: 3,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 12px rgba(22, 51, 74, 0.15)',
                      zIndex: 1,
                    }}
                  >
                    Best for most families
                  </Box>
                )}

                <Box sx={{ mb: 3, mt: plan.isRecommended ? 1 : 0 }}>
                  <Typography
                    variant="overline"
                    sx={{ color: '#999', letterSpacing: 1, display: 'block', mb: 1 }}
                  >
                    {plan.planType}
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{
                      color: '#16334a',
                      fontWeight: 700,
                      mb: 1,
                      fontSize: '1.5rem',
                      minHeight: 64,
                    }}
                  >
                    {plan.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#546669', mb: 2, minHeight: 40 }}>
                    {plan.subtitle}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                    <Typography variant="h3" sx={{ color: '#16334a', fontWeight: 700 }}>
                      ${plan.pricing.monthlyDisplay}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#999' }}>
                      /mo
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ color: '#546669', display: 'block', mt: 0.5, fontWeight: 600 }}
                  >
                    Includes 14-day free trial
                  </Typography>
                </Box>
                <Divider sx={{ my: 2, opacity: 0.3 }} />
                <Box sx={{ flexGrow: 1, mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ color: '#546669', mb: 2 }}>
                    Includes:
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    {plan.features.map((feature, i) => (
                      <FeatureRow key={i} icon={<Check fontSize="small" />} label={feature} included={true} />
                    ))}
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#16334a',
                      fontStyle: 'italic',
                      mt: 3,
                      p: 2,
                      bgcolor: '#f6f3ee',
                      borderRadius: 2,
                    }}
                  >
                    {plan.bestFor}
                  </Typography>
                </Box>
                <Button
                  component={Link}
                  href={`/signup?plan=${plan.id}`}
                  variant="contained"
                  fullWidth
                  sx={{
                    py: 1.5,
                    borderRadius: 3,
                    textTransform: 'none',
                    fontSize: '1rem',
                    backgroundColor: '#16334a',
                    '&:hover': { backgroundColor: '#2e4a62' },
                  }}
                >
                  {plan.ctaText}
                </Button>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Community Self-hosted Callout Banner */}
      <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 6 }}>
        <Card
          sx={{
            p: { xs: 4, md: 5 },
            borderRadius: 4,
            border: '1px dashed rgba(22, 51, 74, 0.2)',
            bgcolor: '#ffffff',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.01)',
          }}
        >
          <Grid container spacing={4} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography
                variant="h4"
                sx={{
                  color: '#16334a',
                  fontWeight: 700,
                  mb: 1.5,
                  fontSize: '1.75rem',
                  fontFamily: 'var(--font-newsreader), serif',
                }}
              >
                Community Self-hosted
              </Typography>
              <Typography variant="body1" sx={{ color: '#16334a', fontWeight: 600, mb: 1 }}>
                Heard Again is open source and available to self-host for free.
              </Typography>
              <Typography variant="body2" sx={{ color: '#546669', mb: 4, lineHeight: 1.6 }}>
                For developers, archivists, nonprofits, and technically comfortable families who
                want full control over their own infrastructure.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  component={Link}
                  href="/setup-guide"
                  variant="contained"
                  sx={{
                    py: 1.25,
                    px: 3,
                    borderRadius: 2.5,
                    textTransform: 'none',
                    fontSize: '0.95rem',
                    backgroundColor: '#16334a',
                    '&:hover': { backgroundColor: '#2e4a62' },
                  }}
                >
                  View self-hosting guide
                </Button>
                <Button
                  component={Link}
                  href="https://github.com/preludeofme/heard-again"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  sx={{
                    py: 1.25,
                    px: 3,
                    borderRadius: 2.5,
                    textTransform: 'none',
                    fontSize: '0.95rem',
                    borderColor: '#16334a',
                    color: '#16334a',
                    '&:hover': { borderColor: '#2e4a62', color: '#2e4a62', bgcolor: 'rgba(22, 51, 74, 0.04)' },
                  }}
                >
                  View source code
                </Button>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: '#16334a', fontWeight: 700, mb: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}
                  >
                    Benefits
                  </Typography>
                  {[
                    'Open-source self-hosting',
                    'Full control of your family data',
                    'Unlimited local storage based on your own hardware',
                    'Community-supported setup',
                  ].map((benefit, idx) => (
                    <FeatureRow key={idx} icon={<Check />} label={benefit} included={true} />
                  ))}
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: '#c0392b', fontWeight: 700, mb: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}
                  >
                    Tradeoffs
                  </Typography>
                  {[
                    'Requires your own hosting',
                    'Requires your own backups',
                    'Requires your own updates',
                    'Requires your own storage and maintenance',
                  ].map((tradeoff, idx) => (
                    <FeatureRow
                      key={idx}
                      icon={<Close />}
                      label={tradeoff}
                      included={false}
                      strikeThrough={false}
                      warning={true}
                    />
                  ))}
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Card>
      </Box>
    </Box>
  )
}
