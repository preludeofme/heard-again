import React from 'react'
import {
  Box,
  Typography,
  Container,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Stack,
  Divider,
  Button,
} from '@mui/material'
import Head from 'next/head'
import Link from 'next/link'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Shield as ShieldIcon,
  VerifiedUser as VerifiedIcon,
  CloudOff as LocalIcon,
  SettingsVoice as VoiceIcon,
  Lock as LockIcon,
  Share as ShareIcon,
} from '@mui/icons-material'
import { PublicHeader } from '../components/layout/PublicHeader'

export default function FAQPage() {
  const faqs = [
    {
      category: 'General',
      items: [
        {
          question: 'What is Heard Again?',
          answer: 'Heard Again is a secure, private family story preservation platform. It allows families to collect voice recordings, photographs, letters, and written journals in one place. Using private AI voice synthesis (TTS), Heard Again can optionally narrate family history in a familiar voice, keeping your stories alive for future generations.'
        },
        {
          question: 'What is Heard Again NOT?',
          answer: 'Heard Again is NOT a public social media network, and it is NOT a data-harvesting advertising platform. There are no public feeds, no "likes," and no public sharing by default. It is a private family vault. We do not monetize your relationships, scan your photos to sell you products, or share your family\'s voice recordings with third parties.'
        },
        {
          question: 'Who owns the stories and voices uploaded to Heard Again?',
          answer: 'Your family owns all data and media, period. Heard Again acts only as a custodian. You can export your entire memory archive or permanently delete your account and all associated assets at any time.'
        }
      ]
    },
    {
      category: 'Voice Laboratory & AI',
      items: [
        {
          question: 'How does the Voice Lab work?',
          answer: 'By uploading high-quality voice samples (such as old voicemails, interviews, or home video audio) of a family member, our private Text-to-Speech (TTS) engine creates a custom voice profile. Once created, the family space can use this profile to read aloud written stories, journals, and records in that person\'s voice.'
        },
        {
          question: 'Can anyone clone my voice without permission?',
          answer: 'Absolutely not. Heard Again requires explicit, documented consent before any voice profile is generated for a living person. Furthermore, voice profiles are strictly insulated and are only accessible to authorized members within your private, authenticated family space. They are never exposed publicly.'
        },
        {
          question: 'Can I permanently delete a voice profile?',
          answer: 'Yes. You can delete any voice profile at any time from your settings. When deleted, all underlying models, training data, voice vectors, and sample files are permanently and completely purged from our servers.'
        }
      ]
    },
    {
      category: 'Privacy & Security',
      items: [
        {
          question: 'Where is my family\'s data stored?',
          answer: 'For our hosted service, your data is securely stored in enterprise-grade, encrypted cloud storage (with data encryption in transit and at rest). Access is restricted exclusively to the specific accounts you authorize. If you prefer complete physical control over your data, you can self-host the entire Heard Again application on your own local computer or server.'
        },
        {
          question: 'Do you sell my data or voice recordings?',
          answer: 'Never. We have a strict zero-advertising model. We make money solely through transparent monthly or annual subscription fees, meaning our interest is fully aligned with protecting your family\'s legacy, not exploiting it.'
        },
        {
          question: 'Are my family\'s memories used to train public AI models?',
          answer: 'No. All AI features (like voice cloning and story transcription) run in fully isolated environments. Your family recordings, documents, and transcripts are never fed back into public datasets (like those of OpenAI, Google, or Anthropic) and will never be used to train models for other users.'
        }
      ]
    },
    {
      category: 'Open Source & Self-Hosting',
      items: [
        {
          question: 'What does "Open Source" mean for Heard Again?',
          answer: 'Heard Again is 100% open-source under a permissive license. This means our entire codebase is public and transparent. Developers and security experts can inspect the code to verify that our security protocols, data handling, and consent mechanisms work exactly as promised. It also guarantees that even if Heard Again as a company ceases to exist, your family will always be able to run the software locally.'
        },
        {
          question: 'What is the Cloud Tunnel / Connected Mode?',
          answer: 'For self-hosted instances, the Cloud Tunnel (via Cloudflare) makes it easy to access your local home server securely from anywhere on the web. It routes traffic through a secure endpoint (e.g. your-subdomain.heardagain.com) without requiring you to open home router ports or manage SSL certificates. Note: This feature is currently in Beta / Coming Soon as we refine the auto-configuration steps, but it is fully active for pre-release testing.'
        }
      ]
    }
  ]

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Head>
        <title>Frequently Asked Questions - Heard Again</title>
        <meta name="description" content="Get answers about Heard Again privacy, security, voice laboratory, and open-source self-hosting." />
      </Head>

      <PublicHeader />

      <Box component="main" sx={{ py: { xs: 8, md: 12 }, flexGrow: 1 }}>
        <Container maxWidth="md">
          <Typography
            variant="h2"
            sx={{
              fontFamily: 'var(--font-newsreader), serif',
              color: 'primary.main',
              mb: 3,
              fontSize: { xs: '2.5rem', md: '3.5rem' },
              textAlign: 'center',
            }}
          >
            Frequently Asked Questions
          </Typography>
          
          <Typography
            variant="body1"
            sx={{
              color: 'secondary.main',
              mb: 8,
              fontSize: '1.2rem',
              textAlign: 'center',
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            Understanding how we protect your family legacy is our highest priority. Learn about our commitment to privacy, voice consent, and technical security.
          </Typography>

          {/* Privacy Trust Card */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              mb: 6,
              borderRadius: 4,
              bgcolor: 'rgba(208, 227, 230, 0.2)',
              border: '1px solid rgba(22, 51, 74, 0.1)',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
              <ShieldIcon sx={{ fontSize: 48, color: 'primary.main' }} />
              <Box>
                <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600, mb: 1 }}>
                  Our Ultimate Guarantee
                </Typography>
                <Typography variant="body2" sx={{ color: 'secondary.main', lineHeight: 1.6 }}>
                  We do not sell data. We do not show ads. We do not train public models.
                  Whether you host with us or run Heard Again on your own hardware, your family’s voices and stories remain entirely under your custody.
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Accordion Categories */}
          {faqs.map((cat, catIdx) => (
            <Box key={catIdx} sx={{ mb: 6 }}>
              <Typography
                variant="h5"
                sx={{
                  color: 'primary.main',
                  fontFamily: 'var(--font-newsreader), serif',
                  fontWeight: 600,
                  mb: 3,
                  borderBottom: '1px solid rgba(22, 51, 74, 0.1)',
                  pb: 1,
                }}
              >
                {cat.category}
              </Typography>
              
              <Stack spacing={2}>
                {cat.items.map((item, itemIdx) => (
                  <Accordion
                    key={itemIdx}
                    elevation={0}
                    sx={{
                      border: '1px solid rgba(22, 51, 74, 0.08)',
                      borderRadius: '8px !important',
                      '&:before': { display: 'none' },
                      bgcolor: 'background.paper',
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon sx={{ color: 'primary.main' }} />}
                      sx={{ py: 1 }}
                    >
                      <Typography sx={{ fontWeight: 600, color: 'primary.main' }}>
                        {item.question}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pb: 3, px: 3 }}>
                      <Typography sx={{ color: 'secondary.main', lineHeight: 1.7 }}>
                        {item.answer}
                      </Typography>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Stack>
            </Box>
          ))}

          {/* Contact Support CTA */}
          <Box sx={{ mt: 8, textAlign: 'center', p: 4, bgcolor: 'rgba(246, 243, 238, 0.5)', borderRadius: 4 }}>
            <Typography variant="h6" sx={{ color: 'primary.main', mb: 1, fontWeight: 600 }}>
              Still have questions?
            </Typography>
            <Typography variant="body2" sx={{ color: 'secondary.main', mb: 3 }}>
              We are here to help you feel confident in preserving your family history.
            </Typography>
            <Button
              variant="contained"
              component={Link}
              href="/contact"
              sx={{ borderRadius: 3, px: 4, py: 1.5 }}
            >
              Get In Touch
            </Button>
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
              <Link href="/terms" style={{ textDecoration: 'none' }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'secondary.main',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  Terms of Service
                </Typography>
              </Link>
              <Link href="/faq" style={{ textDecoration: 'none' }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'secondary.main',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  FAQ
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
