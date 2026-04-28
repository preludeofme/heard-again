import { Box, Typography } from '@mui/material'
import { useRouter } from 'next/router'
import {
  EditNoteRounded,
  GraphicEqRounded,
  PersonRounded,
  ArrowForwardRounded,
} from '@mui/icons-material'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'
import type { ContinueWork } from '@/controllers/useDashboardController'

interface ContinueCardProps {
  continueWork: ContinueWork
}

interface ContinueItem {
  key: string
  icon: React.ReactNode
  label: string
  title: string
  hint: string
  href: string
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function ContinueCard({ continueWork }: ContinueCardProps) {
  const router = useRouter()
  const { recentlyViewedMembers } = useSelectedFamilyMember()

  const items: ContinueItem[] = []

  if (continueWork.lastDraftStory) {
    items.push({
      key: 'draft',
      icon: <EditNoteRounded sx={{ fontSize: 28, color: ProfileColors.primary }} />,
      label: 'Draft story',
      title: continueWork.lastDraftStory.title || 'Untitled story',
      hint: `Edited ${relativeTime(continueWork.lastDraftStory.updatedAt)}`,
      href: `/stories/${continueWork.lastDraftStory.id}`,
    })
  }

  if (continueWork.inProgressVoiceJob) {
    items.push({
      key: 'voice',
      icon: <GraphicEqRounded sx={{ fontSize: 28, color: ProfileColors.primary }} />,
      label: 'Voice generation',
      title: continueWork.inProgressVoiceJob.voiceProfileName,
      hint: `${continueWork.inProgressVoiceJob.status.toLowerCase()} · ${relativeTime(continueWork.inProgressVoiceJob.queuedAt)}`,
      href: `/voice-lab?profileId=${continueWork.inProgressVoiceJob.voiceProfileId}`,
    })
  }

  const lastViewed = recentlyViewedMembers[0]
  if (lastViewed) {
    const personName =
      lastViewed.displayName ||
      `${lastViewed.firstName}${lastViewed.lastName ? ' ' + lastViewed.lastName : ''}`
    items.push({
      key: 'person',
      icon: <PersonRounded sx={{ fontSize: 28, color: ProfileColors.primary }} />,
      label: 'Last viewed',
      title: personName,
      hint: 'Open profile',
      href: `/profile/${lastViewed.id}`,
    })
  }

  if (items.length === 0) return null

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
          fontSize: { xs: '1.5rem', md: '1.75rem' },
          fontWeight: 700,
          color: ProfileColors.primary,
          mb: 3,
        }}
      >
        Pick up where you left off
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {items.map(item => (
          <Box
            key={item.key}
            onClick={() => router.push(item.href)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2.5,
              p: 2.5,
              borderRadius: '1.25rem',
              cursor: 'pointer',
              bgcolor: ProfileColors.surfaceContainerLow,
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: ProfileColors.surfaceContainer,
                transform: 'translateX(4px)',
              },
            }}
          >
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                bgcolor: ProfileColors.surfaceContainerLowest,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {item.icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-manrope), sans-serif',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: ProfileColors.onSurfaceVariant,
                }}
              >
                {item.label}
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-newsreader), serif',
                  fontSize: '1.15rem',
                  fontWeight: 600,
                  color: ProfileColors.primary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.title}
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-manrope), sans-serif',
                  fontSize: '0.85rem',
                  color: ProfileColors.onSurfaceVariant,
                }}
              >
                {item.hint}
              </Typography>
            </Box>
            <ArrowForwardRounded sx={{ color: ProfileColors.primary, fontSize: 20, flexShrink: 0 }} />
          </Box>
        ))}
      </Box>
    </Box>
  )
}
