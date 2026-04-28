import { Box, Typography, Chip } from '@mui/material'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import type { DashboardWorkspace, DashboardUserContext, DashboardStats } from '@/controllers/useDashboardController'

interface WorkspaceHeroProps {
  workspace: DashboardWorkspace | null
  userContext: DashboardUserContext | null
  stats: DashboardStats
  pendingInvites: number
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
  LEGACY: 'Contributor',
}

function buildSummary(stats: DashboardStats): string {
  const parts: string[] = []
  if (stats.people > 0) parts.push(`${stats.people} ${stats.people === 1 ? 'person' : 'people'}`)
  if (stats.stories > 0) parts.push(`${stats.stories} ${stats.stories === 1 ? 'story' : 'stories'}`)
  if (stats.voiceProfiles > 0) parts.push(`${stats.voiceProfiles} ${stats.voiceProfiles === 1 ? 'voice' : 'voices'}`)
  if (parts.length === 0) return 'A new family vault, waiting for its first memory.'
  return `${parts.join(' · ')} preserved`
}

export function WorkspaceHero({ workspace, userContext, stats, pendingInvites }: WorkspaceHeroProps) {
  const name = workspace?.name ?? 'Family Vault'
  const greeting = userContext?.displayName ? `Welcome back, ${userContext.displayName.split(' ')[0]}` : 'Welcome back'
  const role = userContext?.role
  const summary = buildSummary(stats)

  return (
    <Box
      component="section"
      sx={{
        bgcolor: ProfileColors.surfaceContainerLowest,
        borderRadius: '2rem',
        px: { xs: 4, md: 6 },
        py: { xs: 5, md: 7 },
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        gap: { xs: 3, md: 4 },
      }}
    >
      <Box sx={{ flex: 1 }}>
        <Typography
          sx={{
            fontFamily: 'var(--font-manrope), sans-serif',
            fontSize: '0.85rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: ProfileColors.onSurfaceVariant,
            mb: 1,
          }}
        >
          {greeting}
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontFamily: 'var(--font-newsreader), serif',
            fontSize: { xs: '2.5rem', sm: '3rem', md: '3.5rem' },
            fontWeight: 700,
            color: ProfileColors.primary,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          {name}
        </Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-newsreader), serif',
            fontStyle: 'italic',
            fontSize: '1.15rem',
            color: ProfileColors.onSurfaceVariant,
            mt: 1.5,
          }}
        >
          {summary}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', md: 'flex-end' }, gap: 1.5 }}>
        {role && (
          <Chip
            label={ROLE_LABELS[role] ?? role}
            sx={{
              bgcolor: ProfileColors.secondaryContainer,
              color: ProfileColors.onSecondaryContainer,
              fontFamily: 'var(--font-manrope), sans-serif',
              fontWeight: 600,
              fontSize: '0.78rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              borderRadius: '9999px',
              height: 28,
            }}
          />
        )}
        {pendingInvites > 0 && (
          <Chip
            label={`${pendingInvites} pending invite${pendingInvites === 1 ? '' : 's'}`}
            sx={{
              bgcolor: ProfileColors.tertiaryFixed,
              color: ProfileColors.onTertiaryFixedVariant,
              fontFamily: 'var(--font-manrope), sans-serif',
              fontWeight: 600,
              fontSize: '0.78rem',
              borderRadius: '9999px',
              height: 28,
            }}
          />
        )}
      </Box>
    </Box>
  )
}
