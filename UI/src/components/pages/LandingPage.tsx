import React, { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Container,
  Grid,
  Card,
  Avatar,
  useTheme,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Divider,
  Stack,
} from '@mui/material'
import {
  PlayCircle,
  Share,
  Favorite,
  GitHub,
} from '@mui/icons-material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Link from 'next/link'
import { LandingPricingSection } from './LandingPricingSection'
import { PublicHeader } from '../layout/PublicHeader'

// Material Symbols Icon component
const MaterialSymbol = ({ icon, sx }: { icon: string; sx?: any }) => (
  <Typography
    component="span"
    sx={{
      fontFamily: '"Material Symbols Outlined", sans-serif',
      fontSize: 24,
      fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
      lineHeight: 1,
      ...sx,
    }}
  >
    {icon}
  </Typography>
)

const collaborationSteps = [
  {
    icon: 'groups',
    title: 'Invite Family and Friends',
    description: 'Securely invite the people who knew your loved one best. Each contributor can add their own stories, recordings, photos, letters, and reflections — helping preserve memories that might otherwise fade away.',
  },
  {
    icon: 'settings_voice',
    title: 'Save Their Voice',
    description: 'Upload recordings, voicemails, or interviews to save family voices from aging tech. We organize and protect these memories from being lost. Optionally enable story narration in a familiar voice, always with your consent.',
  },
  {
    icon: 'edit_note',
    title: 'Capture the Stories Behind the Photos',
    description: 'Photos show a moment. Stories explain why it mattered. Add written memories, scanned letters, personal notes, family jokes, recipes, sayings, and small details that make someone feel real again.',
  },
  {
    icon: 'auto_stories',
    title: 'Create a Family Legacy Library',
    description: 'Over time, your family’s contributions become something bigger than a scrapbook. They become a private family memory library — one that future generations can read, hear, explore, and add to.',
  },
]

const testimonials = [
  {
    quote: "I had old recordings of my mother, but they were scattered everywhere. Heard Again gave our family one place to preserve them and share the stories behind them.",
    name: 'Heritage Member',
    role: '',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
  },
  {
    quote: "My dad’s friends added memories I had never heard before. It felt like meeting another side of him.",
    name: 'Legacy Builder',
    role: '',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
  },
  {
    quote: "We started this for my grandmother, but it became something our whole family built together.",
    name: 'Family Contributor',
    role: '',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face',
  },
]

export function LandingPage() {
  const theme = useTheme()

  return (
    <Box sx={{ overflow: 'hidden' }}>
      <PublicHeader />
      {/* Hero Section */}
      <Box
        component="section"
        sx={{
          position: 'relative',
          px: { xs: 4, md: 8 },
          pt: 4,
          pb: 16,
          maxWidth: '1400px',
          mx: 'auto',
        }}
      >
        <Grid container spacing={8} alignItems="center">
          <Grid size={{ xs: 12, lg: 6 }} sx={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            {/* Logo/Header matching og-image */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4, width: '100%' }}>
              <Box
                component="img"
                src="/logo-large.png"
                alt="Heard Again Waveform"
                sx={{ height: 72, width: 'auto', mb: 2, mx: 'auto' }}
              />
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '3.5rem', md: '4.5rem', lg: '5.5rem' },
                  lineHeight: 1.0,
                  color: 'primary.main',
                  fontFamily: 'var(--font-newsreader), serif',
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  textAlign: 'center',
                }}
              >
                Heard Again
              </Typography>
              
              {/* Decorative flourish divider */}
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: 450, my: 1.5, mx: 'auto' }}>
                <Box sx={{ flexGrow: 1, height: '1px', bgcolor: '#16334a', opacity: 0.2 }} />
                <Box sx={{ mx: 2, display: 'flex', alignItems: 'center', color: '#16334a', opacity: 0.8 }}>
                  <svg width="40" height="16" viewBox="0 0 40 16" fill="currentColor">
                    <path d="M20 1.5c-1 0-2 1.5-2 3 0 2 2.5 3.5 2 7.5-.5-4 2-5.5 2-7.5 0-1.5-1-3-2-3z" />
                    <path d="M20 12c-4-1-7-3-10-1 4-1 6 1 10 1z" />
                    <path d="M20 12c4-1 7-3 10-1-4-1-6 1-10 1z" />
                    <circle cx="6" cy="11" r="1.5" />
                    <circle cx="34" cy="11" r="1.5" />
                  </svg>
                </Box>
                <Box sx={{ flexGrow: 1, height: '1px', bgcolor: '#16334a', opacity: 0.2 }} />
              </Box>

              <Typography
                variant="h5"
                sx={{
                  fontFamily: 'var(--font-newsreader), serif',
                  fontStyle: 'italic',
                  color: 'primary.main',
                  fontSize: { xs: '1.25rem', md: '1.5rem' },
                  mb: 3,
                  textAlign: 'center',
                }}
              >
                Family stories, preserved with care.
              </Typography>

              {/* Pill-shaped badges */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1.5, mt: 1 }}>
                {[
                  { label: 'Voice Preservation', color: '#6a4c93' },
                  { label: 'Family Stories', color: '#1a5f7a' },
                  { label: 'Consent First', color: '#c19a6b' },
                ].map((badge) => (
                  <Box
                    key={badge.label}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 2,
                      py: 0.75,
                      borderRadius: '20px',
                      border: '1px solid rgba(22, 51, 74, 0.15)',
                      bgcolor: 'rgba(255, 255, 255, 0.4)',
                    }}
                  >
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: badge.color }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main', letterSpacing: '0.02em' }}>
                      {badge.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            <Typography
              variant="body1"
              sx={{
                fontSize: '1.25rem',
                color: 'secondary.main',
                mb: 5,
                maxWidth: 600,
                lineHeight: 1.6,
                textAlign: 'center',
                mx: 'auto',
              }}
            >
              Preserve the voices, stories, and memories of the people who shaped your family. Heard Again gives your family a private place to collect recordings, photos, letters, and personal stories — and, when you choose, hear those memories narrated in a familiar voice again.
              <br /><br />
              <b>Your family&apos;s memories are never sold</b>, never used to train public models, and never shared with third parties. Your family&apos;s legacy stays your way.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'center', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                component={Link}
                href="/signup"
                sx={{
                  px: 4,
                  py: 2,
                  fontSize: '1.1rem',
                  borderRadius: 3,
                }}
              >
                Get Started
              </Button>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }} sx={{ position: 'relative' }}>
            <Box
              sx={{
                aspectRatio: '4/5',
                borderRadius: 8,
                overflow: 'hidden',
                transform: 'rotate(2deg)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              }}
            >
              <Box
                component="img"
                src="https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&h=1000&fit=crop"
                alt="Happy multi-generational family sitting together laughing"
                width={800}
                height={1000}
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </Box>
            <Box
              sx={{
                position: 'absolute',
                bottom: -32,
                left: -32,
                width: 192,
                aspectRatio: '1/1',
                borderRadius: 6,
                overflow: 'hidden',
                transform: 'rotate(-6deg)',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                border: 8,
                borderColor: 'background.default',
              }}
            >
              <Box
                component="img"
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face"
                alt="Close up of a grandfather smiling"
                width={400}
                height={400}
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Collaborative Section */}
      <Box
        component="section"
        sx={{
          bgcolor: 'rgba(208, 227, 230, 0.3)',
          py: 16,
          px: { xs: 4, md: 8 },
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ mb: 10 }}>
            <Typography
              variant="overline"
              sx={{
                color: 'primary.main',
                fontWeight: 700,
                letterSpacing: '0.15em',
                mb: 2,
                display: 'block',
              }}
            >
              COLLABORATIVE STORYTELLING
            </Typography>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '2rem', md: '3rem' },
                color: 'primary.main',
                maxWidth: 700,
                mb: 3,
                fontFamily: 'var(--font-newsreader), serif',
              }}
            >
              A fuller picture, built by everyone who loved them.
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontSize: '1.125rem',
                color: 'secondary.main',
                maxWidth: 600,
              }}
            >
              No one person remembers everything. A daughter may remember bedtime stories. A grandson may remember fishing trips. An old friend may remember the jokes no one else heard. A sibling may remember who they were before they became “Mom,” “Dad,” “Grandpa,” or “Grandma.”<br /><br />
              Heard Again lets family members and trusted friends contribute their own memories, creating a richer and more complete portrait of someone&apos;s life.
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {collaborationSteps.map((step, index) => (
              <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={index}>
                <Card
                  sx={{
                    bgcolor: 'background.paper',
                    p: 4,
                    borderRadius: 4,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: '0 10px 40px rgba(28, 28, 25, 0.08)',
                      transform: 'translateY(-4px)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      bgcolor: 'rgba(22, 51, 74, 0.1)',
                      color: 'primary.main',
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 3,
                      transition: 'all 0.3s ease',
                      '.MuiCard-root:hover &': {
                        bgcolor: 'primary.main',
                        color: 'white',
                      },
                    }}
                  >
                    <MaterialSymbol icon={step.icon} sx={{ fontSize: 28 }} />
                  </Box>
                  <Typography
                    variant="h3"
                    sx={{
                      fontSize: '1.25rem',
                      color: 'primary.main',
                      mb: 2,
                      fontFamily: 'var(--font-newsreader), serif',
                    }}
                  >
                    {step.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: 'secondary.main', lineHeight: 1.6 }}
                  >
                    {step.description}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Testimonials Section */}
      <Box
        component="section"
        sx={{
          py: 16,
          px: { xs: 4, md: 8 },
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              mb: 10,
              gap: 4,
            }}
          >
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '2rem', md: '3rem' },
                color: 'primary.main',
                maxWidth: 500,
                fontFamily: 'var(--font-newsreader), serif',
              }}
            >
              Voices of the Story
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: 'secondary.main',
                maxWidth: 300,
                fontStyle: 'italic',
                borderLeft: 2,
                borderColor: 'primary.main',
                pl: 3,
              }}
            >
              &quot;Over time, your family&apos;s contributions become a private family memory library.&quot;
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {testimonials.map((testimonial, index) => (
              <Grid size={{ xs: 12, lg: 6 }} key={index}>
                <Card
                  sx={{
                    bgcolor: 'background.paper',
                    p: 5,
                    borderRadius: 6,
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    gap: 4,
                    alignItems: 'center',
                    boxShadow: '0 10px 40px rgba(28, 28, 25, 0.04)',
                    transform: index === 1 ? 'translateY(32px)' : 'none',
                  }}
                >
                  <Avatar
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    sx={{ width: 128, height: 128, flexShrink: 0 }}
                  />
                  <Box>
                    <Typography
                      variant="body1"
                      sx={{
                        fontSize: '1.125rem',
                        color: 'primary.main',
                        fontFamily: 'var(--font-newsreader), serif',
                        fontStyle: 'italic',
                        mb: 3,
                        lineHeight: 1.5,
                      }}
                    >
                      &quot;{testimonial.quote}&quot;
                    </Typography>
                    <Box>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 700, color: 'primary.main' }}
                      >
                        {testimonial.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'secondary.main',
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                        }}
                      >
                        {testimonial.role}
                      </Typography>
                    </Box>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Pricing Section */}
      <LandingPricingSection />

      {/* What We Provide & FAQ Section */}
      <Box
        id="faq"
        component="section"
        sx={{
          bgcolor: 'rgba(208, 227, 230, 0.2)',
          py: 16,
          px: { xs: 4, md: 8 },
          borderTop: '1px solid',
          borderBottom: '1px solid',
          borderColor: 'rgba(208, 227, 230, 0.5)',
        }}
      >
        <Container maxWidth="md">
          {/* What We Provide Header */}
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography
              variant="overline"
              sx={{
                color: 'primary.main',
                fontWeight: 700,
                letterSpacing: '0.15em',
                mb: 2,
                display: 'block',
              }}
            >
              OUR MISSION & FEATURES
            </Typography>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '2.5rem', md: '3.5rem' },
                color: 'primary.main',
                mb: 3,
                fontFamily: 'var(--font-newsreader), serif',
              }}
            >
              What We Provide
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontSize: '1.25rem',
                color: 'secondary.main',
                maxWidth: 700,
                mx: 'auto',
                lineHeight: 1.7,
              }}
            >
              Heard Again is a comprehensive family story preservation suite. We provide tools to convert physical memories into a private digital library, ensuring your family legacy is protected, organized, and accessible to future generations.
            </Typography>
          </Box>

          {/* Service Cards / Details */}
          <Grid container spacing={4} sx={{ mb: 10 }}>
            {[
              {
                icon: 'settings_voice',
                title: 'Private Voice Lab',
                description: 'Safely clone and preserve a loved one\'s voice from old audio recordings. The synthesized voice profile is private, securely stored, and used exclusively to narrate written family stories in their familiar voice with family consent.',
              },
              {
                icon: 'auto_stories',
                title: 'Interactive Family Scrapbook',
                description: 'Create a rich digital history repository. Upload photos, scanned letters, personal documents, and audio tracks, link them to specific individuals, and view them on an interactive family timeline.',
              },
              {
                icon: 'keyboard_voice',
                title: 'Smart Transcription Pipeline',
                description: 'Convert cassette tapes, home video soundtracks, and oral interviews into clean, searchable, and formatted text. Our private, isolated processing ensures no third party hears your audio.',
              },
              {
                icon: 'groups',
                title: 'Collaborative Memories',
                description: 'Invite family members and old friends as contributors. Each person can safely add their own perspective, voice notes, and stories, forming a multi-dimensional portrait of family history.',
              },
              {
                icon: 'security',
                title: 'Absolute Privacy & Control',
                description: 'Securely store your family memories with our encrypted SaaS app, ensuring all your data remains private, secure, and under your absolute control.',
              },
            ].map((service, index) => (
              <Grid size={{ xs: 12, md: 6 }} key={index}>
                <Card
                  elevation={0}
                  sx={{
                    p: 4,
                    height: '100%',
                    borderRadius: 4,
                    bgcolor: 'background.paper',
                    border: '1px solid rgba(22, 51, 74, 0.05)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: '0 12px 30px rgba(28, 28, 25, 0.05)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 2,
                        bgcolor: 'rgba(22, 51, 74, 0.08)',
                        color: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <MaterialSymbol icon={service.icon} sx={{ fontSize: 24 }} />
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600, mb: 1 }}>
                        {service.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'secondary.main', lineHeight: 1.6 }}>
                        {service.description}
                      </Typography>
                    </Box>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Divider sx={{ mb: 10, borderColor: 'rgba(22, 51, 74, 0.1)' }} />

          {/* FAQ Section */}
          <Box>
            <Typography
              variant="h3"
              sx={{
                fontSize: { xs: '2rem', md: '2.5rem' },
                color: 'primary.main',
                mb: 6,
                textAlign: 'center',
                fontFamily: 'var(--font-newsreader), serif',
              }}
            >
              Frequently Asked Questions
            </Typography>

            <Stack spacing={2}>
              {[
                {
                  q: 'What is Heard Again and what is it NOT?',
                  a: 'Heard Again is a secure and private legacy preservation vault, it is NOT a public social media network or marketing platform. There are no public feeds or open sharing unless you decide to share it broadly. Your space is fully customizable and can be open or closed, and you can specify who is allowed to see your family history/stories. We do not sell user data, monetize relationship details, or use ads.',
                },
                {
                  q: 'How does the Voice Lab protect user privacy?',
                  a: 'Voice cloning is completely private and requires active consent. When you upload voice samples, our system uses an isolated, temporary computer processor to build the voice profile. This processor does not save your original audio recordings—it only reads them once to create the voice clone, and then immediately and permanently deletes the raw files from the processing area. The created voice profile remains strictly locked in your private space, and you can permanently delete it at any time.',
                },
                {
                  q: 'Do you train public AI models on my family recordings?',
                  a: 'No. Our transcription and Text-to-Speech (TTS) models process all audio in isolated environments. Your family records, audio, and stories are never used to train public models (like those from OpenAI or Google) and are never shared with other customers.',
                },
                {
                  q: 'Who owns the uploaded data?',
                  a: 'Your family owns 100% of the data and media. You can download a complete archive of your family stories and recordings or delete them entirely at any time. We believe in total data custody, so you always retain full ownership.',
                },
                {
                  q: 'Can I try Heard Again before I buy it?',
                  a: 'Yes! We offer a 14-day free trial on all plans—allowing you to set up your family space, try out the Voice Lab, and upload memories before your billing begins.',
                },
              ].map((faq, index) => (
                <Accordion
                  key={index}
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
                      {faq.q}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pb: 3, px: 3 }}>
                    <Typography sx={{ color: 'secondary.main', lineHeight: 1.7 }}>
                      {faq.a}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Final CTA Banner */}
      <Box
        component="section"
        sx={{
          px: { xs: 4, md: 8 },
          mt: 10,
          mb: 10,
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              borderRadius: 8,
              bgcolor: 'primary.main',
              p: { xs: 6, md: 12 },
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(135deg, rgba(22,51,74,0.4) 0%, transparent 100%)',
                pointerEvents: 'none',
              }}
            />
            <Box sx={{ position: 'relative', zIndex: 10 }}>
              <Typography
                variant="h2"
                sx={{
                  fontSize: { xs: '2rem', md: '3.5rem' },
                  color: 'white',
                  mb: 4,
                  fontFamily: 'var(--font-newsreader), serif',
                }}
              >
                Begin with one story.
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontSize: '1.25rem',
                  color: 'rgba(255,255,255,0.8)',
                  maxWidth: 600,
                  mx: 'auto',
                  mb: 6,
                }}
              >
                You do not need to have everything ready. Start with a voicemail. A cassette tape. A favorite memory. A letter. A story your family always tells.<br /><br />
                Heard Again gives your family a private place to preserve it — and, when the time feels right, a way to hear those memories again.
              </Typography>
              <Button
                variant="outlined"
                size="large"
                component={Link}
                href="/signup"
                sx={{
                  bgcolor: '#e0c29a',
                  color: '#281801',
                  px: 6,
                  py: 2.5,
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  borderRadius: 3,
                  '&:hover': {
                    bgcolor: '#d4b68e',
                    boxShadow: '0 15px 35px rgba(0,0,0,0.35)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                Start preserving your family&apos;s stories today
              </Button>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mt: 4,
                  color: 'rgba(255,255,255,0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                No credit card required to begin.
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
          pt: 6,
          pb: { xs: 12, md: 6 },
          px: { xs: 4, md: 8 },
          mt: 10,
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Box>
              <Box
                component="img"
                src="/logo-small.png"
                alt=""
                sx={{ height: 14, width: 'auto', mb: 0.3 }}
              />
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'var(--font-newsreader), serif',
                  fontStyle: 'italic',
                  color: 'primary.main',
                  mb: 1,
                }}
              >
                Heard Again
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'secondary.main',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Family stories, preserved with care. &copy; {new Date().getFullYear()} Heard Again.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
              <Link href="/privacy" style={{ textDecoration: 'none' }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'secondary.main',
                    '&:hover': { color: 'primary.main' },
                    transition: 'color 0.2s',
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
                    transition: 'color 0.2s',
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
                    transition: 'color 0.2s',
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
                    transition: 'color 0.2s',
                  }}
                >
                  Contact Us
                </Typography>
              </Link>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                component="a"
                href="https://github.com/preludeofme/heard-again"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                sx={{
                  minWidth: 0,
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  p: 0,
                  borderColor: 'rgba(22,51,74,0.2)',
                  color: 'primary.main',
                  '&:hover': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    borderColor: 'primary.main',
                  },
                }}
              >
                <GitHub sx={{ fontSize: 20 }} />
              </Button>
              <Button
                variant="outlined"
                aria-label="Share"
                sx={{
                  minWidth: 0,
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  p: 0,
                  borderColor: 'rgba(22,51,74,0.2)',
                  color: 'primary.main',
                  '&:hover': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    borderColor: 'primary.main',
                  },
                }}
              >
                <Share sx={{ fontSize: 20 }} />
              </Button>
              <Button
                variant="outlined"
                aria-label="Favorite"
                sx={{
                  minWidth: 0,
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  p: 0,
                  borderColor: 'rgba(22,51,74,0.2)',
                  color: 'primary.main',
                  '&:hover': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    borderColor: 'primary.main',
                  },
                }}
              >
                <Favorite sx={{ fontSize: 20 }} />
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  )
}
