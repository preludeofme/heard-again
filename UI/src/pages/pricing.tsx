import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { GetStaticProps } from 'next'
import { Box, Container, Typography } from '@mui/material'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { LandingPricingSection } from '@/components/pages/LandingPricingSection'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import { fetchPublicCloudPlans } from '@/lib/billing/public-plans'
import { findEntryVoiceTier, findNoVoiceTier } from '@/lib/billing/plan-display'
import type { PublicPlan } from '@/lib/billing/public-plans.types'

const PAGE_TITLE = 'Pricing — Heard Again'
const CANONICAL_URL = 'https://www.heardagain.com/pricing'

/** Re-read the `Plan` rows at most every 5 minutes, so a price edit reaches the page on its own. */
const REVALIDATE_SECONDS = 300

type PricingPageProps = {
  plans: PublicPlan[]
}

export const getStaticProps: GetStaticProps<PricingPageProps> = async () => {
  return {
    props: { plans: await fetchPublicCloudPlans() },
    revalidate: REVALIDATE_SECONDS,
  }
}

export default function PricingPage({ plans }: PricingPageProps): React.ReactElement {
  // The two tiers this page's lede turns on: the cheapest one with no voice at all,
  // and the cheapest one you can actually buy voice on. Both come from the rows so
  // the prose cannot quote a price the cards disagree with.
  const noVoiceTier = findNoVoiceTier(plans)
  const entryVoiceTier = findEntryVoiceTier(plans)

  const pageDescription = entryVoiceTier
    ? `Heard Again pricing: self-host free, or managed cloud from $${
        noVoiceTier?.priceMonthlyDisplay ?? entryVoiceTier.priceMonthlyDisplay
      }/mo. Voice generation starts on ${entryVoiceTier.name} at $${
        entryVoiceTier.priceMonthlyDisplay
      }/mo${noVoiceTier ? ` — ${noVoiceTier.name} includes no voice minutes` : ''}.`
    : 'Heard Again pricing: self-host the open-source platform free, or choose a managed cloud plan so you do not have to run a GPU.'

  return (
    <>
      <Head>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={CANONICAL_URL} />
        <meta property="og:title" content={PAGE_TITLE} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={CANONICAL_URL} />
      </Head>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: ProfileColors.surface,
        }}
      >
        <PublicHeader />

        <Box component="main" sx={{ flexGrow: 1 }}>
          <Box
            component="section"
            sx={{ pt: { xs: 8, md: 12 }, pb: { xs: 2, md: 4 }, px: { xs: 4, md: 8 } }}
          >
            <Container maxWidth="md" sx={{ textAlign: 'center' }}>
              <Typography
                variant="h1"
                sx={{
                  color: '#16334a',
                  fontFamily: 'var(--font-newsreader), serif',
                  fontSize: { xs: '2.25rem', md: '3rem' },
                  mb: 3,
                }}
              >
                Heard Again pricing
              </Typography>
              <Typography variant="h6" sx={{ color: '#546669', lineHeight: 1.7, mb: 3 }}>
                The code is MIT licensed and free to self-host forever. Paid plans exist so you do
                not have to run the GPU that voice work needs.
              </Typography>
              {noVoiceTier && entryVoiceTier && (
                <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.7 }}>
                  One thing to be clear about before you choose:{' '}
                  <strong>
                    {noVoiceTier.name} (${noVoiceTier.priceMonthlyDisplay}/mo) includes no voice
                    generation minutes
                  </strong>
                  . It is hosting and sharing only. Voice narration and voice clones start on{' '}
                  <strong>
                    {entryVoiceTier.name} (${entryVoiceTier.priceMonthlyDisplay}/mo)
                  </strong>
                  . If voice is why you are here, {entryVoiceTier.name} is the lowest plan that does
                  it.
                </Typography>
              )}
            </Container>
          </Box>

          <LandingPricingSection plans={plans} />

          <Box
            component="section"
            sx={{ py: { xs: 6, md: 8 }, px: { xs: 4, md: 8 }, textAlign: 'center' }}
          >
            <Container maxWidth="sm">
              <Typography variant="body2" sx={{ color: '#546669', lineHeight: 1.7 }}>
                Still deciding? <Link href="/#faq">Read the FAQ</Link> or{' '}
                <Link href="/support">ask us a question</Link>. Paid plans include a 14-day free
                trial, and you can cancel from your account at any time.
              </Typography>
            </Container>
          </Box>
        </Box>

        <Box
          component="footer"
          sx={{
            bgcolor: ProfileColors.surfaceContainerLow,
            borderTop: '1px solid rgba(22, 51, 74, 0.08)',
            py: 4,
            textAlign: 'center',
            mt: 'auto',
          }}
        >
          <Container maxWidth="lg">
            <Typography variant="body2" sx={{ color: ProfileColors.onSecondaryContainer }}>
              © {new Date().getFullYear()} Heard Again. All rights reserved.
            </Typography>
          </Container>
        </Box>
      </Box>
    </>
  )
}
