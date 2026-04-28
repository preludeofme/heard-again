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
    { key: 'hasFirstPerson', label: 'Add your first family member', hint: 'A name and a few details to start the tree', href: '/family-tree', done: state.hasFirstPerson },
    { key: 'hasFirstStory', label: 'Capture your first story', hint: 'Write a memory or record one', href: '/stories#contribution-hub', done: state.hasFirstStory },
    { key: 'hasFirstDocument', label: 'Upload a photo or document', hint: 'Add to the archive — letters, photos, certificates', href: '/documents', done: state.hasFirstDocument },
    { key: 'hasFirstVoice', label: 'Create a voice profile', hint: 'Clone a voice to read stories aloud', href: '/voice-lab', done: state.hasFirstVoice },
  ]

  if ((role === 'OWNER' || role === 'ADMIN') && familyspaceId) {
    steps.push({
      key: 'hasInvitedMember',
      label: 'Invite a family member',
      hint: 'Share the vault with relatives',
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
