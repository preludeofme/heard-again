import React from 'react'
import { Box, Typography, Container } from '@mui/material'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { AnimatedWaveform } from '@/components/brand/AnimatedWaveform'
import Link from 'next/link'
import Head from 'next/head'

export default function TermsLegacyPage() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Head>
        <title>Terms of Legacy - Heard Again</title>
      </Head>
      <PublicHeader />
      
      {/* Main Content */}
      <Box component="main" sx={{ py: 8, flexGrow: 1 }}>
        <Container maxWidth="md">
          <Typography variant="h3" sx={{ mb: 4, fontFamily: 'var(--font-newsreader), serif' }}>
            Terms of Legacy
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            The previous version of our Terms of Service has been superseded.
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Please refer to our current Terms of Service for the most up-to-date information about your rights and responsibilities when using Heard Again.
          </Typography>
          <Link href="/terms" style={{ color: '#1a6b5a', fontSize: '1.125rem' }}>
            View Current Terms of Service →
          </Link>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          bgcolor: 'rgba(208, 227, 230, 0.3)',
          py: 4,
          px: { xs: 4, md: 8 },
          mt: 'auto',
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <AnimatedWaveform height={24} sx={{ mb: 0.3 }} />
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'var(--font-newsreader), serif',
                  fontStyle: 'italic',
                  color: 'primary.main',
                }}
              >
                Heard Again
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'secondary.main', display: 'block' }}
              >
                &copy; {new Date().getFullYear()} Heard Again. A sanctuary for identity.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
              <Link href="/privacy" style={{ textDecoration: 'none' }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'secondary.main',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  Privacy Policy
                </Typography>
              </Link>
              <Link href="/terms-legacy" style={{ textDecoration: 'none' }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'secondary.main',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  Terms of Legacy
                </Typography>
              </Link>
              <Link href="/contact" style={{ textDecoration: 'none' }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'secondary.main',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  Contact Us
                </Typography>
              </Link>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  )
}

export async function getServerSideProps() { return { props: {} } }
