import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Box, Typography, Grid, Card, CardActionArea, CardContent, Button, Avatar, Chip } from '@mui/material'
import {
  Mic as MicIcon,
  EditNote as EditNoteIcon,
  CloudUpload as UploadIcon,
  PersonAdd as PersonAddIcon,
  AutoStories as StoriesIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'
import { ProfileColors } from '@/components/profile/ProfileConstants'

interface ContributionOption {
  key: string
  title: string
  description: string
  icon: React.ReactNode
  accent: string
  href: string
}

export default function ContributePage() {
  const router = useRouter()
  const { selectedFamilyMember } = useSelectedFamilyMember()

  const subjectName = selectedFamilyMember?.displayName
    || (selectedFamilyMember
      ? `${selectedFamilyMember.firstName}${selectedFamilyMember.lastName ? ` ${selectedFamilyMember.lastName}` : ''}`
      : null)

  const heroLine = subjectName
    ? `Help tell ${subjectName}'s story.`
    : 'Help tell their story.'

  const heroSub = subjectName
    ? `Add a memory, upload a keepsake, or record your voice — every contribution becomes part of ${subjectName}'s living story.`
    : "Add a memory, upload a keepsake, or record your voice. Every contribution becomes part of your family's living story."

  const memoryHref = selectedFamilyMember?.id
    ? `/stories/contribute?subjectId=${selectedFamilyMember.id}`
    : '/stories/contribute'

  const options: ContributionOption[] = [
    {
      key: 'memory',
      title: 'Add a Memory',
      description: 'Write a story, anecdote, or favorite moment from your life together.',
      icon: <EditNoteIcon sx={{ fontSize: 32 }} />,
      accent: ProfileColors.tertiaryFixed,
      href: memoryHref,
    },
    {
      key: 'voice',
      title: 'Record a Voice Memory',
      description: 'Speak from the heart. Capture a story, message, or favorite phrase in their own voice.',
      icon: <MicIcon sx={{ fontSize: 32 }} />,
      accent: ProfileColors.secondaryContainer,
      href: '/memories?lens=voices',
    },
    {
      key: 'keepsake',
      title: 'Upload a Keepsake',
      description: 'Add letters, recipes, photos, certificates, or handwritten notes to the story.',
      icon: <UploadIcon sx={{ fontSize: 32 }} />,
      accent: ProfileColors.surfaceContainerHigh,
      href: '/memories?lens=keepsakes',
    },
    {
      key: 'invite',
      title: 'Invite Family',
      description: 'Bring loved ones into the story so they can share their own memories.',
      icon: <PersonAddIcon sx={{ fontSize: 32 }} />,
      accent: ProfileColors.tertiaryFixedDim,
      href: '/account#invite',
    },
  ]

  const handleNavigate = (href: string) => {
    router.push(href)
  }

  return (
    <>
      <Head>
        <title>Contribute | Heard Again</title>
        <meta name="description" content="Help tell their story — add a memory, upload a keepsake, or record a voice." />
      </Head>
      <Layout>
        <Box sx={{ minHeight: '100vh', backgroundColor: ProfileColors.surface }}>
          {/* Hero */}
          <Box
            component="section"
            sx={{
              px: { xs: 3, md: 8 },
              pt: { xs: 6, md: 10 },
              pb: { xs: 4, md: 6 },
              backgroundColor: ProfileColors.surfaceContainerLow,
            }}
          >
            <Box sx={{ maxWidth: 1080, mx: 'auto', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 4, md: 8 }, alignItems: { xs: 'flex-start', md: 'center' } }}>
              <Box sx={{ flex: 1 }}>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-manrope), sans-serif',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: ProfileColors.onSurfaceVariant,
                    mb: 1.5,
                  }}
                >
                  Contribute
                </Typography>
                <Typography
                  component="h1"
                  sx={{
                    fontFamily: 'var(--font-newsreader), serif',
                    fontSize: { xs: '2.5rem', sm: '3rem', md: '3.75rem' },
                    fontWeight: 700,
                    color: ProfileColors.primary,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.05,
                    fontStyle: 'italic',
                  }}
                >
                  {heroLine}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-newsreader), serif',
                    fontSize: { xs: '1.05rem', md: '1.2rem' },
                    color: ProfileColors.onSurfaceVariant,
                    mt: 2.5,
                    maxWidth: 600,
                    lineHeight: 1.6,
                  }}
                >
                  {heroSub}
                </Typography>
              </Box>

              {selectedFamilyMember && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    px: 3,
                    py: 2,
                    borderRadius: '999px',
                    backgroundColor: ProfileColors.surfaceContainerLowest,
                    boxShadow: '0 4px 20px rgba(28, 28, 25, 0.04)',
                  }}
                >
                  <Avatar
                    src={selectedFamilyMember.avatarUrl ?? undefined}
                    sx={{ width: 48, height: 48, bgcolor: ProfileColors.secondaryContainer, color: ProfileColors.primary, fontFamily: 'var(--font-newsreader), serif', fontWeight: 700 }}
                  >
                    {selectedFamilyMember.firstName?.[0] ?? '?'}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontFamily: 'var(--font-manrope), sans-serif', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: ProfileColors.onSurfaceVariant }}>
                      Contributing for
                    </Typography>
                    <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '1.1rem', fontWeight: 600, color: ProfileColors.primary }}>
                      {subjectName}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>

          {/* Contribution options */}
          <Box component="section" sx={{ px: { xs: 3, md: 8 }, py: { xs: 6, md: 8 } }}>
            <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
              <Grid container spacing={{ xs: 3, md: 4 }}>
                {options.map((option) => (
                  <Grid key={option.key} size={{ xs: 12, sm: 6 }}>
                    <Card
                      sx={{
                        backgroundColor: ProfileColors.surfaceContainerLowest,
                        borderRadius: '24px',
                        boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
                        height: '100%',
                        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 10px 40px rgba(28, 28, 25, 0.08)',
                        },
                      }}
                    >
                      <CardActionArea
                        onClick={() => handleNavigate(option.href)}
                        sx={{ height: '100%', borderRadius: '24px' }}
                        aria-label={option.title}
                      >
                        <CardContent sx={{ p: { xs: 4, md: 5 }, height: '100%', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                          <Box
                            sx={{
                              width: 64,
                              height: 64,
                              borderRadius: '20px',
                              backgroundColor: option.accent,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: ProfileColors.primary,
                            }}
                          >
                            {option.icon}
                          </Box>
                          <Typography
                            component="h2"
                            sx={{
                              fontFamily: 'var(--font-newsreader), serif',
                              fontSize: { xs: '1.5rem', md: '1.75rem' },
                              fontWeight: 600,
                              color: ProfileColors.primary,
                              lineHeight: 1.2,
                            }}
                          >
                            {option.title}
                          </Typography>
                          <Typography
                            sx={{
                              fontFamily: 'var(--font-manrope), sans-serif',
                              fontSize: '1rem',
                              color: ProfileColors.onSurfaceVariant,
                              lineHeight: 1.6,
                            }}
                          >
                            {option.description}
                          </Typography>
                          <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center', gap: 1, color: ProfileColors.primary, fontWeight: 600 }}>
                            <Typography sx={{ fontFamily: 'var(--font-manrope), sans-serif', fontSize: '0.95rem', fontWeight: 600 }}>
                              Begin
                            </Typography>
                            <ArrowForwardIcon sx={{ fontSize: 18 }} />
                          </Box>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              {/* Quiet, encouraging footer */}
              <Box
                sx={{
                  mt: { xs: 6, md: 10 },
                  px: { xs: 3, md: 6 },
                  py: { xs: 4, md: 6 },
                  borderRadius: '24px',
                  backgroundColor: ProfileColors.surfaceContainerLow,
                  textAlign: 'center',
                }}
              >
                <StoriesIcon sx={{ fontSize: 36, color: ProfileColors.primary, mb: 2 }} />
                <Typography
                  sx={{
                    fontFamily: 'var(--font-newsreader), serif',
                    fontSize: { xs: '1.4rem', md: '1.7rem' },
                    fontStyle: 'italic',
                    color: ProfileColors.primary,
                    mb: 1,
                  }}
                >
                  &ldquo;The best way to remember is to share.&rdquo;
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-manrope), sans-serif',
                    fontSize: '0.95rem',
                    color: ProfileColors.onSurfaceVariant,
                    mb: 3,
                  }}
                >
                  Every memory you contribute becomes part of a story that lasts beyond a lifetime.
                </Typography>
                <Button
                  component={Link}
                  href="/memories"
                  variant="text"
                  endIcon={<ArrowForwardIcon />}
                  sx={{
                    color: ProfileColors.primary,
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: '1rem',
                    '&:hover': { backgroundColor: 'transparent', transform: 'translateX(4px)' },
                  }}
                >
                  Return to the Story
                </Button>
              </Box>
            </Box>
          </Box>
        </Box>
      </Layout>
    </>
  )
}
