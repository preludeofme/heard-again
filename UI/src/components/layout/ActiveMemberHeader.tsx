import { useState, useRef } from 'react'
import { Box, Typography, Avatar } from '@mui/material'
import { KeyboardArrowDown as ArrowDownIcon } from '@mui/icons-material'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'
import { MemberSwitcherFlyout } from './MemberSwitcherFlyout'

interface ActiveMemberHeaderProps {
  /** When true the component renders in compact pill form (mobile / sidebar inline).
   *  When false it renders as a full-width sidebar block. */
  compact?: boolean
}

export function ActiveMemberHeader({ compact = true }: ActiveMemberHeaderProps) {
  const { selectedFamilyMember } = useSelectedFamilyMember()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const buttonRef = useRef<HTMLElement | null>(null)

  const handleOpen = () => setAnchorEl(buttonRef.current)
  const handleClose = () => setAnchorEl(null)

  const displayName = selectedFamilyMember
    ? selectedFamilyMember.displayName ||
      `${selectedFamilyMember.firstName}${selectedFamilyMember.lastName ? ` ${selectedFamilyMember.lastName}` : ''}`
    : null

  if (compact) {
    return (
      <>
        <Box
          ref={buttonRef}
          component="button"
          onClick={handleOpen}
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: 2,
            backgroundColor: selectedFamilyMember ? '#16334a' : 'rgba(22, 51, 74, 0.05)',
            border: selectedFamilyMember ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(22, 51, 74, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer',
            outline: 'none',
            '&:hover': {
              backgroundColor: selectedFamilyMember ? '#2e4a62' : 'rgba(22, 51, 74, 0.1)',
            },
          }}
        >
          {selectedFamilyMember ? (
            <>
              <Avatar
                src={selectedFamilyMember.avatarUrl || undefined}
                sx={{ width: 24, height: 24, fontSize: 11, border: '1px solid rgba(255,255,255,0.2)' }}
              >
                {selectedFamilyMember.firstName[0]}
              </Avatar>
              <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500, whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                {displayName}
              </Typography>
            </>
          ) : (
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, color: '#546669', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}
            >
              Everyone's Story
            </Typography>
          )}
          <ArrowDownIcon sx={{ fontSize: 14, color: selectedFamilyMember ? 'rgba(255,255,255,0.7)' : '#546669' }} />
        </Box>

        <MemberSwitcherFlyout anchorEl={anchorEl} onClose={handleClose} />
      </>
    )
  }

  // Full-width sidebar block
  return (
    <>
      <Box
        ref={buttonRef}
        component="button"
        onClick={handleOpen}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 3,
          py: 1.5,
          borderRadius: 2,
          cursor: 'pointer',
          border: selectedFamilyMember ? '1px solid #adcae6' : '1px solid transparent',
          backgroundColor: selectedFamilyMember ? '#e8f0f6' : 'transparent',
          outline: 'none',
          textAlign: 'left',
          '&:hover': { backgroundColor: 'rgba(22, 51, 74, 0.1)' },
          transition: 'background-color 0.2s',
        }}
      >
        <Avatar
          src={selectedFamilyMember?.avatarUrl || undefined}
          sx={{
            width: 36,
            height: 36,
            fontSize: 14,
            bgcolor: selectedFamilyMember ? '#16334a' : '#d0e3e6',
            color: selectedFamilyMember ? '#fff' : '#16334a',
            border: selectedFamilyMember ? '2px solid #16334a' : '2px solid #d0e3e6',
            flexShrink: 0,
          }}
        >
          {selectedFamilyMember?.firstName?.[0] ?? '?'}
        </Avatar>
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          <Typography
            variant="caption"
            sx={{ display: 'block', color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.65rem', fontWeight: 600 }}
          >
            Viewing
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: selectedFamilyMember ? '#16334a' : '#546669',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {displayName ?? "Everyone's Story"}
          </Typography>
        </Box>
        <ArrowDownIcon sx={{ fontSize: 16, color: '#546669', flexShrink: 0 }} />
      </Box>

      <MemberSwitcherFlyout anchorEl={anchorEl} onClose={handleClose} />
    </>
  )
}
