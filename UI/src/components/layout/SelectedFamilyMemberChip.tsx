import { Chip, Avatar, Box, Tooltip, IconButton } from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import Link from 'next/link'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'

export function SelectedFamilyMemberChip() {
  const { selectedFamilyMember, clearSelectedFamilyMember } = useSelectedFamilyMember()

  if (!selectedFamilyMember) {
    return null
  }

  const displayName = selectedFamilyMember.displayName 
    || `${selectedFamilyMember.firstName}${selectedFamilyMember.lastName ? ` ${selectedFamilyMember.lastName}` : ''}`

  return (
    <Tooltip title={`Viewing content for ${displayName}. Click to go to profile.`}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Chip
          component={Link}
          href={`/profile/${selectedFamilyMember.id}`}
          avatar={
            <Avatar 
              src={selectedFamilyMember.avatarUrl || undefined}
              sx={{ width: 24, height: 24 }}
            >
              {selectedFamilyMember.firstName[0]}
            </Avatar>
          }
          label={displayName}
          size="small"
          sx={{
            backgroundColor: '#16334a',
            color: '#fff',
            fontWeight: 500,
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: '#2e4a62',
            },
            '& .MuiChip-avatar': {
              color: '#16334a',
              backgroundColor: '#fff',
            },
            '& .MuiChip-label': {
              color: '#fff',
            },
          }}
          onDelete={(e) => {
            e.preventDefault()
            e.stopPropagation()
            clearSelectedFamilyMember()
          }}
          deleteIcon={
            <IconButton
              size="small"
              sx={{ 
                color: '#fff',
                p: 0.25,
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)',
                },
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                clearSelectedFamilyMember()
              }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          }
        />
      </Box>
    </Tooltip>
  )
}
