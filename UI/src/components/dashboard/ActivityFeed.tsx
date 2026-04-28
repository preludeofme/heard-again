import { Box, Typography } from '@mui/material'
import { useRouter } from 'next/router'
import {
  ChatBubbleRounded,
  CloudUploadRounded,
  GraphicEqRounded,
} from '@mui/icons-material'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import type { ActivityEntry } from '@/controllers/useDashboardController'

interface ActivityFeedProps {
  entries: ActivityEntry[]
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 14) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function iconFor(kind: ActivityEntry['kind']) {
  if (kind === 'comment') return <ChatBubbleRounded sx={{ fontSize: 18, color: ProfileColors.primary }} />
  if (kind === 'upload') return <CloudUploadRounded sx={{ fontSize: 18, color: ProfileColors.primary }} />
  return <GraphicEqRounded sx={{ fontSize: 18, color: ProfileColors.primary }} />
}

export function ActivityFeed({ entries }: ActivityFeedProps) {
  const router = useRouter()

  if (entries.length === 0) return null

  return (
    <Box
      component="section"
      sx={{
        bgcolor: ProfileColors.surfaceContainerLowest,
        borderRadius: '2rem',
        p: { xs: 4, md: 5 },
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        height: '100%',
      }}
    >
      <Typography
        sx={{
          fontFamily: 'var(--font-newsreader), serif',
          fontSize: { xs: '1.4rem', md: '1.6rem' },
          fontWeight: 700,
          color: ProfileColors.primary,
          mb: 3,
        }}
      >
        Recent activity
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {entries.map((entry, idx) => (
          <Box
            key={`${entry.kind}-${entry.at}-${idx}`}
            onClick={() => entry.href && router.push(entry.href)}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
              p: 1.5,
              borderRadius: '1rem',
              cursor: entry.href ? 'pointer' : 'default',
              transition: 'background 0.2s',
              '&:hover': entry.href ? { bgcolor: ProfileColors.surfaceContainerLow } : {},
            }}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                bgcolor: ProfileColors.surfaceContainerLow,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                mt: 0.25,
              }}
            >
              {iconFor(entry.kind)}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-manrope), sans-serif',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  color: ProfileColors.primary,
                  lineHeight: 1.35,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {entry.title}
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-manrope), sans-serif',
                  fontSize: '0.8rem',
                  color: ProfileColors.onSurfaceVariant,
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {entry.actor} · {relativeTime(entry.at)}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
