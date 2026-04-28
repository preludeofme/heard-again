import { Box, Typography, LinearProgress } from '@mui/material'
import { useRouter } from 'next/router'
import { ArrowForwardRounded } from '@mui/icons-material'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import type { BillingUsage } from '@/controllers/useDashboardController'

interface SubscriptionStatusCardProps {
  usage: BillingUsage | null
  planType: string
}

interface UsageBar {
  label: string
  percent: number
  detail: string
}

function colorForPercent(percent: number) {
  if (percent >= 90) return '#c0392b'
  if (percent >= 70) return '#d4881e'
  return ProfileColors.primary
}

export function SubscriptionStatusCard({ usage, planType }: SubscriptionStatusCardProps) {
  const router = useRouter()
  if (!usage) return null

  const bars: UsageBar[] = [
    {
      label: 'Storage',
      percent: usage.storage.percentUsed,
      detail: `${usage.storage.formattedUsed} of ${usage.storage.formattedQuota}`,
    },
    {
      label: 'Generation minutes',
      percent: usage.generation.percentUsed,
      detail: `${usage.generation.minutesUsed} of ${usage.generation.minutesQuota || '∞'} min`,
    },
    {
      label: 'Members',
      percent: usage.members.quota > 0 ? Math.round((usage.members.count / usage.members.quota) * 100) : 0,
      detail: `${usage.members.count} of ${usage.members.quota}`,
    },
  ]

  const maxPercent = Math.max(...bars.map(b => b.percent))
  // Hide entirely if usage is comfortably under 70% on every dimension
  if (maxPercent < 70) return null

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
            fontSize: { xs: '1.4rem', md: '1.6rem' },
            fontWeight: 700,
            color: ProfileColors.primary,
          }}
        >
          {planType} plan
        </Typography>
        <Box
          onClick={() => router.push('/account/billing')}
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
          Manage <ArrowForwardRounded sx={{ fontSize: 16 }} />
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
        {bars.map(bar => (
          <Box key={bar.label}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-manrope), sans-serif',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: ProfileColors.primary,
                }}
              >
                {bar.label}
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-manrope), sans-serif',
                  fontSize: '0.78rem',
                  color: ProfileColors.onSurfaceVariant,
                }}
              >
                {bar.percent}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(bar.percent, 100)}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: ProfileColors.surfaceContainer,
                '& .MuiLinearProgress-bar': {
                  bgcolor: colorForPercent(bar.percent),
                  borderRadius: 3,
                },
              }}
            />
            <Typography
              sx={{
                fontFamily: 'var(--font-manrope), sans-serif',
                fontSize: '0.75rem',
                color: ProfileColors.onSurfaceVariant,
                mt: 0.5,
              }}
            >
              {bar.detail}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
