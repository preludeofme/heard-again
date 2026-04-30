import { Box, Typography, Chip, Avatar } from '@mui/material'
import { useRouter } from 'next/router'
import {
  PushPinRounded,
  HeadphonesRounded,
  ArrowForwardRounded,
  AutoStoriesRounded,
} from '@mui/icons-material'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import type { DashboardStory } from '@/controllers/useDashboardController'

interface RecentStoriesFeedProps {
  stories: DashboardStory[]
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function RecentStoriesFeed({ stories }: RecentStoriesFeedProps) {
  const router = useRouter()

  return (
    <Box
      component="section"
      sx={{
        bgcolor: ProfileColors.surfaceContainerLowest,
        borderRadius: '2rem',
        p: { xs: 4, md: 5 },
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 3 }}>
        <Typography
          sx={{
            fontFamily: 'var(--font-newsreader), serif',
            fontSize: { xs: '1.5rem', md: '1.75rem' },
            fontWeight: 700,
            color: ProfileColors.primary,
          }}
        >
          Latest stories
        </Typography>
        <Box
          onClick={() => router.push('/archive?lens=stories')}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: 'pointer',
            color: ProfileColors.primary,
            fontFamily: 'var(--font-manrope), sans-serif',
            fontWeight: 600,
            fontSize: '0.85rem',
            '&:hover': { opacity: 0.7 },
          }}
        >
          See all <ArrowForwardRounded sx={{ fontSize: 16 }} />
        </Box>
      </Box>

      {stories.length === 0 ? (
        <Box
          onClick={() => router.push('/contribute')}
          sx={{
            textAlign: 'center',
            py: 6,
            px: 3,
            borderRadius: '1.5rem',
            bgcolor: ProfileColors.surfaceContainerLow,
            cursor: 'pointer',
            transition: 'background 0.2s',
            '&:hover': { bgcolor: ProfileColors.surfaceContainer },
          }}
        >
          <AutoStoriesRounded sx={{ fontSize: 40, color: ProfileColors.primary, opacity: 0.6, mb: 1 }} />
          <Typography
            sx={{
              fontFamily: 'var(--font-newsreader), serif',
              fontStyle: 'italic',
              fontSize: '1.15rem',
              color: ProfileColors.onSurfaceVariant,
              mb: 0.5,
            }}
          >
            No stories yet
          </Typography>
          <Typography
            sx={{
              fontFamily: 'var(--font-manrope), sans-serif',
              fontSize: '0.9rem',
              color: ProfileColors.primary,
              fontWeight: 600,
            }}
          >
            Record one in 2 minutes →
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {stories.slice(0, 6).map(story => (
            <Box
              key={story.id}
              onClick={() => router.push(`/stories/${story.id}`)}
              sx={{
                p: 2.5,
                borderRadius: '1.25rem',
                bgcolor: ProfileColors.surfaceContainerLow,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: ProfileColors.surfaceContainer,
                  transform: 'translateX(4px)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                {story.isPinned && <PushPinRounded sx={{ fontSize: 16, color: ProfileColors.primary, transform: 'rotate(45deg)' }} />}
                <Typography
                  sx={{
                    flex: 1,
                    fontFamily: 'var(--font-newsreader), serif',
                    fontSize: '1.15rem',
                    fontWeight: 600,
                    color: ProfileColors.primary,
                    lineHeight: 1.3,
                  }}
                >
                  {story.title}
                </Typography>
                {story.hasNarration && (
                  <HeadphonesRounded sx={{ fontSize: 18, color: ProfileColors.primary, opacity: 0.7 }} />
                )}
              </Box>
              <Typography
                sx={{
                  fontFamily: 'var(--font-manrope), sans-serif',
                  fontSize: '0.9rem',
                  color: ProfileColors.onSurfaceVariant,
                  lineHeight: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {story.excerpt}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5, flexWrap: 'wrap' }}>
                {story.subject && (
                  <Chip
                    avatar={
                      story.subject.avatarAssetId ? (
                        <Avatar src={`/api/assets/serve/${story.subject.avatarAssetId}`} />
                      ) : undefined
                    }
                    label={story.subject.name}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/profile/${story.subject!.id}`)
                    }}
                    sx={{
                      bgcolor: ProfileColors.secondaryContainer,
                      color: ProfileColors.onSecondaryContainer,
                      fontFamily: 'var(--font-manrope), sans-serif',
                      fontWeight: 600,
                      fontSize: '0.72rem',
                      height: 22,
                    }}
                  />
                )}
                <Typography
                  sx={{
                    fontFamily: 'var(--font-manrope), sans-serif',
                    fontSize: '0.78rem',
                    color: ProfileColors.onSurfaceVariant,
                  }}
                >
                  {formatDate(story.storyDate ?? story.createdAt)}
                </Typography>
                {story.status === 'DRAFT' && (
                  <Typography
                    sx={{
                      fontFamily: 'var(--font-manrope), sans-serif',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: ProfileColors.onTertiaryFixedVariant,
                      bgcolor: ProfileColors.tertiaryFixed,
                      px: 1,
                      py: 0.25,
                      borderRadius: '6px',
                    }}
                  >
                    Draft
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
