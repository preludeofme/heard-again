import { Box, Typography, LinearProgress } from '@mui/material'
import { CheckCircleRounded, RadioButtonUncheckedRounded, ArrowForwardRounded } from '@mui/icons-material'
import { useRouter } from 'next/router'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import type { OnboardingState, FamilyspaceRole } from '@/controllers/useDashboardController'

interface OnboardingChecklistProps {
  state: OnboardingState
  role: FamilyspaceRole
  familyspaceId: string | null
}

interface Step {
  key: keyof OnboardingState
  label: string
  hint: string
  href: string
  done: boolean
}

export function OnboardingChecklist({ state, role, familyspaceId }: OnboardingChecklistProps) {
  const router = useRouter()

  const steps: Step[] = [
    { key: 'hasFirstPerson', label: 'Who are you preserving this for?', hint: 'Start the archive with a person\'s name.', href: '/family-tree', done: state.hasFirstPerson },
    { key: 'hasFirstStory', label: 'Share the first memory', hint: 'One moment — written or spoken.', href: '/contribute', done: state.hasFirstStory },
    { key: 'hasFirstDocument', label: 'Add a keepsake', hint: 'A photo, a letter, or any artifact worth preserving.', href: '/archive?lens=keepsakes', done: state.hasFirstDocument },
    { key: 'hasFirstVoice', label: 'Preserve their voice', hint: 'Upload a recording to create a voice that lasts.', href: '/archive?lens=voices', done: state.hasFirstVoice },
  ]

  if ((role === 'OWNER' || role === 'ADMIN') && familyspaceId) {
    steps.push({
      key: 'hasInvitedMember',
      label: 'Invite family to contribute',
      hint: 'More voices make the story richer.',
      href: `/familyspaces/${familyspaceId}/settings`,
      done: state.hasInvitedMember,
    })
  }

  const completedCount = steps.filter(s => s.done).length
  const allDone = completedCount === steps.length
  if (allDone) return null

  const percent = Math.round((completedCount / steps.length) * 100)

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
        <Typography
          sx={{
            fontFamily: 'var(--font-newsreader), serif',
            fontSize: { xs: '1.5rem', md: '1.75rem' },
            fontWeight: 700,
            color: ProfileColors.primary,
          }}
        >
          Get started
        </Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-manrope), sans-serif',
            fontSize: '0.85rem',
            color: ProfileColors.onSurfaceVariant,
            fontWeight: 600,
          }}
        >
          {completedCount} of {steps.length}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percent}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: ProfileColors.surfaceContainer,
          mb: 3,
          '& .MuiLinearProgress-bar': { bgcolor: ProfileColors.primary, borderRadius: 3 },
        }}
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {steps.map(step => (
          <Box
            key={step.key}
            onClick={() => !step.done && router.push(step.href)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 2,
              borderRadius: '1rem',
              cursor: step.done ? 'default' : 'pointer',
              bgcolor: step.done ? 'transparent' : ProfileColors.surfaceContainerLow,
              transition: 'background 0.2s',
              opacity: step.done ? 0.55 : 1,
              '&:hover': step.done ? {} : { bgcolor: ProfileColors.surfaceContainer },
            }}
          >
            {step.done ? (
              <CheckCircleRounded sx={{ color: ProfileColors.primary, fontSize: 24 }} />
            ) : (
              <RadioButtonUncheckedRounded sx={{ color: ProfileColors.outlineVariant, fontSize: 24 }} />
            )}
            <Box sx={{ flex: 1 }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-manrope), sans-serif',
                  fontSize: '0.98rem',
                  fontWeight: 600,
                  color: step.done ? ProfileColors.onSurfaceVariant : ProfileColors.primary,
                  textDecoration: step.done ? 'line-through' : 'none',
                }}
              >
                {step.label}
              </Typography>
              {!step.done && (
                <Typography
                  sx={{
                    fontFamily: 'var(--font-manrope), sans-serif',
                    fontSize: '0.85rem',
                    color: ProfileColors.onSurfaceVariant,
                    mt: 0.25,
                  }}
                >
                  {step.hint}
                </Typography>
              )}
            </Box>
            {!step.done && <ArrowForwardRounded sx={{ color: ProfileColors.primary, fontSize: 20 }} />}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
