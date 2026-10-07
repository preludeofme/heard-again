import React from 'react'
import { Box, Typography, Card, Grid, Button, Divider } from '@mui/material'
import { Check, Close } from '@mui/icons-material'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { trackPlanSelected, surfaceForPath } from '@/lib/analytics/funnel'
import { FeatureRow } from './FeatureRow'
import { SystemRequirements } from './SystemRequirements'
import {
  LANDING_PLAN_COPY,
  PUBLIC_PLAN_SLUGS,
  type LandingFeature,
  type LandingPlanCopy,
  type PlanFactFeature,
} from '@/lib/billing/landing-plan-copy'
import {
  generationMinutesFact,
  prioritySupportFact,
  storageQuotaFact,
  voiceProfileQuotaFact,
  type PlanFact,
} from '@/lib/billing/plan-display'
import type { PublicPlan } from '@/lib/billing/public-plans.types'

export type LandingPricingSectionProps = {
  /** The advertised cloud tiers, read from the `Plan` table by the page that mounts this. */
  plans: PublicPlan[]
}

/** A tier the page can draw: a live `Plan` row paired with the prose we wrote for it. */
type LandingCard = {
  plan: PublicPlan
  copy: LandingPlanCopy
  ctaText: string
  ctaHref: string
  note: string
}

/** `/signup?plan=cloud_mid` -> `cloud_mid`; the tier the click actually buys. */
function planFromCtaHref(ctaHref: string): string {
  const query = ctaHref.split('?')[1]
  if (!query) return 'none'
  return new URLSearchParams(query).get('plan') ?? 'none'
}

function resolveFact(field: PlanFactFeature['field'], plan: PublicPlan): PlanFact | null {
  switch (field) {
    case 'minutes':
      return generationMinutesFact(plan.generationMinutesIncluded)
    case 'storage':
      return storageQuotaFact(plan.storageQuotaBytes)
    case 'voiceProfiles':
      return voiceProfileQuotaFact(plan.voiceProfileQuota)
    case 'prioritySupport':
      return prioritySupportFact(plan.prioritySupport)
  }
}

function FactLabel({ fact }: { fact: PlanFact }) {
  return (
    <>
      {fact.segments.map((segment, i) =>
        segment.isStrong ? (
          <strong key={i}>{segment.text}</strong>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </>
  )
}

function PlanFeatureList({ plan, copy }: { plan: PublicPlan; copy: LandingPlanCopy }) {
  return (
    <Box sx={{ mt: 2 }}>
      {copy.features.map((feature: LandingFeature, i) => {
        if (feature.kind === 'prose') {
          const label = feature.isLead ? (
            <span style={{ color: '#16334a', fontWeight: 600 }}>{feature.text}</span>
          ) : feature.isStrong ? (
            <strong>{feature.text}</strong>
          ) : (
            feature.text
          )
          return (
            <FeatureRow key={i} icon={<Check fontSize="small" />} label={label} included={true} />
          )
        }

        const fact = resolveFact(feature.field, plan)
        if (!fact) {
          return null
        }

        // A zero allowance stays on the card as an explicit "not included" line.
        // Dropping it would let Lite look like it might still do voice work.
        return (
          <FeatureRow
            key={i}
            icon={fact.isMuted ? <Close fontSize="small" /> : <Check fontSize="small" />}
            label={<FactLabel fact={fact} />}
            included={!fact.isMuted}
            strikeThrough={false}
          />
        )
      })}
    </Box>
  )
}

/**
 * Pairs each advertised slug with its row. A slug with no row is skipped rather
 * than drawn from a literal, so the page can never quote a price we cannot verify.
 */
function buildCards(plans: PublicPlan[]): LandingCard[] {
  const planBySlug = new Map(plans.map((plan) => [plan.slug, plan]))

  return PUBLIC_PLAN_SLUGS.flatMap((slug) => {
    const plan = planBySlug.get(slug)
    const copy = LANDING_PLAN_COPY[slug]
    if (!plan || !copy) {
      return []
    }

    return [
      {
        plan,
        copy,
        ctaText: plan.isAvailable ? copy.ctaText : copy.unavailable.ctaText,
        ctaHref: plan.isAvailable ? `/signup?plan=${slug}` : copy.unavailable.ctaHref,
        note: plan.isAvailable ? copy.trialNote : copy.unavailable.note,
      },
    ]
  })
}

export function LandingPricingSection({ plans }: LandingPricingSectionProps) {
  const router = useRouter()
  const cards = buildCards(plans)

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

      {/* Why pay when the code is free */}
      <Box sx={{ maxWidth: 820, mx: 'auto', mb: 8 }}>
        <Box sx={{ p: 3, bgcolor: '#f6f3ee', borderRadius: 2, textAlign: 'left' }}>
          <Typography variant="subtitle1" sx={{ color: '#16334a', fontWeight: 700, mb: 1 }}>
            Why pay, when the code is free?
          </Typography>
          <Typography variant="body2" sx={{ color: '#546669', lineHeight: 1.7 }}>
            Heard Again is MIT licensed. You can download it and run it yourself at no cost, forever
            — and the paid plans do not unlock extra features you cannot get that way.
            <br />
            <br />
            What you pay for is not having to run a GPU. Voice work needs one. Self-hosting means you
            buy or rent that hardware, install the models, keep the machine patched, and do your own
            backups. On a cloud plan we keep the GPU, the updates, and the backups running, and you
            just upload audio. That is the whole difference.
          </Typography>
        </Box>
      </Box>

      {/* Main Pricing Cards Grid */}
      <Box sx={{ maxWidth: 1400, mx: 'auto', mb: 8 }}>
        {cards.length === 0 ? (
          // The plan rows could not be read. Say that plainly instead of leaving a
          // silent gap where four prices used to be — and never fall back to a
          // literal, because an unverified price is the bug this section fixes.
          <Box
            sx={{
              maxWidth: 820,
              mx: 'auto',
              p: 4,
              bgcolor: '#f6f3ee',
              borderRadius: 2,
              textAlign: 'center',
            }}
          >
            <Typography variant="subtitle1" sx={{ color: '#16334a', fontWeight: 700, mb: 1 }}>
              Plan prices are temporarily unavailable
            </Typography>
            <Typography variant="body2" sx={{ color: '#546669', lineHeight: 1.7 }}>
              We could not load the current cloud plan prices, and we would rather show you nothing
              than show you a price we cannot confirm. Please try again in a few minutes, or{' '}
              <Link href="/support">ask us</Link> and we will quote you directly. Self-hosting is
              free and always available below.
            </Typography>
          </Box>
        ) : (
        <Grid container spacing={4} justifyContent="center" alignItems="stretch">
          {cards.map(({ plan, copy, ctaText, ctaHref, note }) => (
            <Grid key={plan.slug} size={{ xs: 12, md: 6, lg: 3 }}>
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
                  border: copy.isRecommended ? '2.5px solid #16334a' : '1px solid rgba(0,0,0,0.05)',
                  boxShadow: copy.isRecommended
                    ? '0 8px 30px rgba(22, 51, 74, 0.08)'
                    : '0 4px 20px rgba(0,0,0,0.02)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
                  },
                }}
              >
                {copy.isRecommended && (
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

                <Box sx={{ mb: 3, mt: copy.isRecommended ? 1 : 0 }}>
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
                    {copy.subtitle}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                    <Typography variant="h3" sx={{ color: '#16334a', fontWeight: 700 }}>
                      ${plan.priceMonthlyDisplay}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#999' }}>
                      /mo
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ color: '#546669', display: 'block', mt: 0.5, fontWeight: 600 }}
                  >
                    {note}
                  </Typography>
                </Box>
                <Divider sx={{ my: 2, opacity: 0.3 }} />
                <Box sx={{ flexGrow: 1, mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ color: '#546669', mb: 2 }}>
                    Includes:
                  </Typography>
                  <PlanFeatureList plan={plan} copy={copy} />
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
                    {copy.bestFor}
                  </Typography>
                </Box>
                <Button
                  component={Link}
                  href={ctaHref}
                  onClick={() =>
                    trackPlanSelected({
                      card: plan.slug,
                      plan: planFromCtaHref(ctaHref),
                      surface: surfaceForPath(router.pathname),
                    })
                  }
                  variant={plan.isAvailable ? 'contained' : 'outlined'}
                  fullWidth
                  sx={{
                    py: 1.5,
                    borderRadius: 3,
                    textTransform: 'none',
                    fontSize: '1rem',
                    ...(plan.isAvailable
                      ? {
                          backgroundColor: '#16334a',
                          '&:hover': { backgroundColor: '#2e4a62' },
                        }
                      : {
                          borderColor: '#16334a',
                          color: '#16334a',
                          '&:hover': {
                            borderColor: '#2e4a62',
                            color: '#2e4a62',
                            bgcolor: 'rgba(22, 51, 74, 0.04)',
                          },
                        }),
                  }}
                >
                  {ctaText}
                </Button>
              </Card>
            </Grid>
          ))}
        </Grid>
        )}
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

          <Divider sx={{ my: 4, borderColor: 'rgba(22, 51, 74, 0.1)' }} />

          <SystemRequirements />
        </Card>
      </Box>
    </Box>
  )
}
