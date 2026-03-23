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
    title: 'Invite Contributors',
    description: 'Securely invite family members and lifelong friends to join the archive as storytellers.',
  },
  {
    icon: 'settings_voice',
    title: 'Voice Memories',
    description: 'Anyone invited can record audio stories, capturing the diverse voices that defined a lifetime.',
  },
  {
    icon: 'edit_note',
    title: 'Text & Anecdotes',
    description: 'Share written memories, letters, and the little details only close friends would remember.',
  },
  {
    icon: 'auto_stories',
    title: 'The Living Record',
    description: 'Witness as individual contributions weave together into a complete, soulful family tree.',
  },
]

const testimonials = [
  {
    quote: "It's incredible to see the archive grow. My father's old army buddies added stories I'd never heard before. It's like seeing him through new eyes.",
    name: 'Eleanor Vance',
    role: 'Heritage Member',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
  },
  {
    quote: "We started this for my grandmother, but seeing all my cousins contribute their own memories has turned it into a family bonding experience.",
    name: 'Julian Thorne',
    role: 'Legacy Builder',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
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
          pt: 10,
          pb: 16,
          maxWidth: '1400px',
          mx: 'auto',
        }}
      >
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
              Preserve the voices that matter most
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontSize: '1.25rem',
                color: 'secondary.main',
                mb: 5,
                maxWidth: 500,
                lineHeight: 1.6,
              }}
            >
              A collaborative sanctuary for your family&apos;s identity. Invite loved ones to share memories and build a collective portrait of a legacy that lasts forever.
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
                Start Your Archive
              </Button>
              <Button
                variant="text"
                size="large"
                startIcon={<PlayCircle />}
                sx={{
                  px: 4,
                  py: 2,
                  color: 'primary.main',
                  fontWeight: 600,
                  '&:hover': {
                    bgcolor: 'rgba(208, 227, 230, 0.3)',
                  },
                }}
              >
                Watch the Story
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
              A collective portrait, built by those who love them.
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontSize: '1.125rem',
                color: 'secondary.main',
                maxWidth: 600,
              }}
            >
              Legacies aren&apos;t built in isolation. Heard Again allows friends and family to contribute their unique perspectives, forming a rich, multi-faceted history.
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
              Voices of the Archive
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
              &quot;Preserving my mother&apos;s voice was the greatest gift I could give my children.&quot;
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
                Begin your legacy today.
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
                Join thousands of families who are ensuring their stories are heard for generations. Secure your memories now.
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
                Create Your Free Account
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
                No credit card required to start recording.
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
