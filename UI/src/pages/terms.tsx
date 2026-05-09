import React from 'react'
import {
  Box,
  Typography,
  Container,
  Button,
  useTheme,
  Divider,
} from '@mui/material'
import Head from 'next/head'
import Link from 'next/link'

export default function TermsOfLegacyPage() {
  const theme = useTheme()

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Head>
        <title>Terms of Legacy - Heard Again</title>
      </Head>

      {/* Header */}
      <Box
        component="header"
        sx={{
          bgcolor: 'background.default',
          borderBottom: '1px solid',
          borderColor: 'rgba(208, 227, 230, 0.5)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              py: 2,
            }}
          >
            <Typography
              variant="h6"
              component={Link}
              href="/"
              sx={{
                fontFamily: 'var(--font-newsreader), serif',
                fontStyle: 'italic',
                color: 'primary.main',
                fontSize: '1.5rem',
                textDecoration: 'none',
              }}
            >
              Heard Again
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button
                component={Link}
                href="/pricing"
                variant="text"
                sx={{ color: 'secondary.main', fontWeight: 600 }}
              >
                Pricing
              </Button>
              <Button
                component={Link}
                href="/privacy"
                variant="text"
                sx={{ color: 'secondary.main', fontWeight: 600 }}
              >
                Privacy
              </Button>
              <Button
                component={Link}
                href="/terms"
                variant="text"
                sx={{ color: 'secondary.main', fontWeight: 600 }}
              >
                Terms & Conditions
              </Button>
              <Button
                component={Link}
                href="/login"
                variant="text"
                sx={{ color: 'secondary.main' }}
              >
                Sign In
              </Button>
              <Button
                component={Link}
                href="/signup"
                variant="contained"
              >
                Start Story
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Main Content */}
      <Box component="main" sx={{ py: { xs: 8, md: 12 }, flexGrow: 1 }}>
        <Container maxWidth="md">
          <Typography
            variant="h2"
            sx={{
              fontFamily: 'var(--font-newsreader), serif',
              color: 'primary.main',
              mb: 2,
              fontSize: { xs: '2.5rem', md: '3.5rem' },
            }}
          >
            Terms of Legacy
          </Typography>
          <Typography variant="body1" sx={{ color: 'secondary.main', mb: 6, fontSize: '1.125rem' }}>
            Last updated: May 9, 2026
          </Typography>

          <Box sx={{ '& > *': { mb: 4 } }}>
            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 2 }}>
                Welcome to Heard Again
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8 }}>
                By using Heard Again, you are entering into a partnership with us to preserve your family's history. These "Terms of Legacy" govern your use of our platform and services.
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 2 }}>
                1. Account Responsibility
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8 }}>
                You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. You must be at least 18 years old to create an account.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 2 }}>
                2. Content Ownership
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8 }}>
                You retain full ownership of all content (stories, audio, photos, etc.) you upload to the platform. By uploading content, you grant Heard Again a limited, non-exclusive license solely to process and display that content for you and your invited family members.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 2 }}>
                3. Voice Ethics & Consent
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8 }}>
                The use of AI voice synthesis is a powerful tool for legacy preservation. You agree to only create voice models for individuals who have given explicit consent, or for deceased family members where you have the legal right to do so as a direct descendant or executor. You agree not to use our voice synthesis features to impersonate others for deceptive or malicious purposes.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 2 }}>
                4. Acceptable Use
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8 }}>
                You agree not to use the platform to store or share content that is illegal, defamatory, or violates the privacy or intellectual property rights of others.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 2 }}>
                5. Termination of Service
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8 }}>
                You can close your account and delete your data at any time. We reserve the right to suspend or terminate accounts that violate these terms.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 2 }}>
                6. Disclaimer of Warranties
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8 }}>
                While we strive for 100% availability and data integrity, the service is provided "as is". We encourage regular exports of your data for your own offline backups.
              </Typography>
            </Box>
          </Box>
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
            <Box>
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
                © 2024 Heard Again. A sanctuary for identity.
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
              <Link href="/terms" style={{ textDecoration: 'none' }}>
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
