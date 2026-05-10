import { Box, Typography } from '@mui/material'
import { useRouter } from 'next/router'
import {
  AutoStoriesRounded,
  PersonAddAlt1Rounded,
  CloudUploadRounded,
  ChatBubbleOutlineRounded,
  GraphicEqRounded,
  AccountTreeRounded,
} from '@mui/icons-material'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import type { FamilyspaceRole } from '@/controllers/useDashboardController'

interface QuickActionsRailProps {
  role: FamilyspaceRole
}

interface Action {
  key: string
  label: string
  icon: React.ReactNode
  href: string
}

const ALL_ACTIONS: Action[] = [
  { key: 'story', label: 'Share a Memory', icon: <AutoStoriesRounded />, href: '/contribute' },
  { key: 'person', label: 'Add to Family', icon: <PersonAddAlt1Rounded />, href: '/family-tree' },
  { key: 'upload', label: 'Add Keepsake', icon: <CloudUploadRounded />, href: '/legacy?lens=keepsakes' },
  { key: 'voice', label: 'Voice Memories', icon: <GraphicEqRounded />, href: '/legacy?lens=voices' },
  { key: 'tree', label: 'Family Tree', icon: <AccountTreeRounded />, href: '/family-tree' },
]

const VIEWER_ACTIONS: Action[] = [
  { key: 'story', label: 'Read Stories', icon: <AutoStoriesRounded />, href: '/legacy?lens=stories' },
  { key: 'tree', label: 'Family Tree', icon: <AccountTreeRounded />, href: '/family-tree' },
]

export function QuickActionsRail({ role }: QuickActionsRailProps) {
  const router = useRouter()
  const actions = role === 'VIEWER' || role === 'LEGACY' ? VIEWER_ACTIONS : ALL_ACTIONS

  return (
    <Box
      component="section"
      sx={{
        display: 'flex',
        gap: 1.5,
        overflowX: 'auto',
        pb: 1,
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      {actions.map(action => (
        <Box
          key={action.key}
          onClick={() => router.push(action.href)}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1.25,
            px: 3,
            py: 1.5,
            bgcolor: ProfileColors.surfaceContainerLowest,
            color: ProfileColors.primary,
            borderRadius: '9999px',
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            transition: 'all 0.2s',
            border: `1px solid ${ProfileColors.outlineVariant}`,
            '&:hover': {
              bgcolor: ProfileColors.primary,
              color: '#fff',
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 20px rgba(22,51,74,0.15)',
              borderColor: ProfileColors.primary,
            },
            '& svg': { fontSize: 20 },
          }}
        >
          {action.icon}
          <Typography
            sx={{
              fontFamily: 'var(--font-manrope), sans-serif',
              fontWeight: 600,
              fontSize: '0.95rem',
              whiteSpace: 'nowrap',
            }}
          >
            {action.label}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}
