import React from 'react'
import {
  Box,
  Typography,
  Button,
  Container,
  Grid,
  Card,
  Avatar,
  useTheme,
} from '@mui/material'
import {
  PlayCircle,
  Share,
  Favorite,
} from '@mui/icons-material'
import Link from 'next/link'
import { LandingPricingSection } from './LandingPricingSection'

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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 8 }}>
          <Typography
            variant="h5"
            sx={{
              fontFamily: 'var(--font-newsreader), serif',
              fontStyle: 'italic',
              color: 'primary.main',
              fontWeight: 700,
            }}
          >
            Heard Again
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              component={Link}
              href="/pricing"
              variant="text"
              sx={{
                color: 'primary.main',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              Pricing
            </Button>
            <Button
              component={Link}
              href="/privacy"
              variant="text"
              sx={{
                color: 'primary.main',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              Privacy
            </Button>
            <Button
              component={Link}
              href="/terms"
              variant="text"
              sx={{
                color: 'primary.main',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              Terms & Conditions
            </Button>
            <Button
              component={Link}
              href="/login"
              variant="contained"
              sx={{
                ml: 1,
                borderRadius: '999px',
                px: 3,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Sign In
            </Button>
          </Box>
        </Box>
        <Grid container spacing={8} alignItems="center">
          <Grid size={{ xs: 12, lg: 6 }} sx={{ position: 'relative', zIndex: 10 }}>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '3rem', md: '4rem', lg: '5rem' },
                lineHeight: 1.1,
                mb: 4,
                color: 'primary.main',
                fontFamily: 'var(--font-newsreader), serif',
              }}
            >
              Stories fade. Voices don&apos;t have to.
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontSize: '1.25rem',
                color: 'secondary.main',
                mb: 5,
                maxWidth: 600,
                lineHeight: 1.6,
              }}
            >
              Preserve the voices, stories, and memories of the people who shaped your family. Heard Again gives your family a private place to collect recordings, photos, letters, and personal stories — and, when you choose, hear those memories narrated in a familiar voice again.
              <br /><br />
              <b>Your family&apos;s memories are never sold</b>, never used to train public models, and never shared with third parties. Cloud-host with us, or self-host it yourself. Your family&apos;s legacy stays your way.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
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
                Start Your Story
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
          py: 6,
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
                Family stories, preserved with care. © 2026 Heard Again.
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
                  Terms of Legacy
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
