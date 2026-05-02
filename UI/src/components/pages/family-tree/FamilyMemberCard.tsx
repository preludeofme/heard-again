import React from 'react'
import {
  Box,
  Typography,
  Card,
  Avatar,
  Button,
  IconButton,
} from '@mui/material'
import {
  AutoStories,
  Edit,
  PersonAddOutlined as PersonAdd,
  PeopleAltOutlined as PeopleIcon,
  AccountTreeOutlined as TreeIcon,
} from '@mui/icons-material'

import { TreeNodeLevel, TreePerson } from './types'

interface FamilyMemberCardProps {
  person: TreePerson
  level: TreeNodeLevel
  isSelf?: boolean
  cardWidth: number
  isMobile: boolean
  onPersonClick: (person: TreePerson) => void
  onAddPerson: () => void
  onViewArchive: (person: TreePerson) => void
  onToggleSiblings?: () => void
  onSetRoot?: (id: string) => void
  includeSiblings?: boolean
}

export function FamilyMemberCard({
  person,
  level,
  isSelf,
  cardWidth,
  isMobile,
  onPersonClick,
  onAddPerson,
  onViewArchive,
  onToggleSiblings,
  onSetRoot,
  includeSiblings,
}: FamilyMemberCardProps) {
  const isParentLevel = level === 'parent'
  const selfCardColor = '#1a6b5a'
  const selfCardOutline = 'rgba(26, 107, 90, 0.08)'

  // Mobile: compact card — tap opens detail modal; no inline action buttons
  if (isMobile) {
    const avatarSize = isParentLevel ? 36 : level === 'grandparent' ? 30 : 28
    return (
      <Card
        tabIndex={0}
        onClick={() => onPersonClick(person)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPersonClick(person) } }}
        sx={{
          bgcolor: isParentLevel
            ? (isSelf ? selfCardColor : 'primary.main')
            : 'background.paper',
          p: 1.5,
          borderRadius: isParentLevel ? 4 : 3,
          width: cardWidth,
          cursor: 'pointer',
          boxShadow: isParentLevel
            ? '0 8px 20px rgba(0,0,0,0.12)'
            : '0 4px 12px rgba(28,28,25,0.06)',
          border: isParentLevel ? 'none' : '1px solid rgba(22,51,74,0.06)',
          outline: isParentLevel && isSelf ? `4px solid ${selfCardOutline}` : 'none',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar
            src={person.avatar}
            sx={{
              width: avatarSize,
              height: avatarSize,
              flexShrink: 0,
              border: isParentLevel ? '1.5px solid rgba(205,229,255,0.4)' : 'none',
            }}
          />
          <Box sx={{ overflow: 'hidden', minWidth: 0 }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-newsreader), serif',
                fontSize: isParentLevel ? '0.8rem' : '0.72rem',
                fontWeight: 600,
                color: isParentLevel ? 'white' : 'primary.main',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.2,
              }}
            >
              {person.name}
            </Typography>
            {isParentLevel && (
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  color: 'rgba(255,255,255,0.6)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {person.memories ? `${person.memories} memories` : 'Tap to view'}
              </Typography>
            )}
          </Box>
          {isSelf && isParentLevel && onToggleSiblings && (
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onToggleSiblings() }}
              sx={{ color: 'white', ml: 'auto', p: 0.5 }}
            >
              <PeopleIcon sx={{ fontSize: 16, opacity: includeSiblings ? 1 : 0.6 }} />
            </IconButton>
          )}
        </Box>
      </Card>
    )
  }

  // Desktop: full card with action buttons
  return (
    <Card
      tabIndex={0}
      onClick={() => onPersonClick(person)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPersonClick(person) } }}
      sx={
        isParentLevel
          ? {
            bgcolor: isSelf ? selfCardColor : 'primary.main',
            p: 4,
            borderRadius: 6,
            width: cardWidth,
            position: 'relative',
            boxShadow: isSelf
              ? '0 20px 25px -5px rgba(26, 107, 90, 0.18)'
              : '0 20px 25px -5px rgba(0,0,0,0.1)',
            outline: 8,
            outlineColor: isSelf ? selfCardOutline : 'rgba(22, 51, 74, 0.05)',
            cursor: 'pointer',
          }
          : {
            bgcolor: 'background.paper',
            p: 3,
            borderRadius: 4,
            width: cardWidth,
            boxShadow: '0 10px 40px rgba(28, 28, 25, 0.06)',
            border: '1px solid',
            borderColor: 'rgba(22, 51, 74, 0.05)',
            transition: 'transform 0.3s',
            cursor: 'pointer',
            '&:hover': { transform: 'translateY(-4px)' },
          }
      }
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: isParentLevel ? 3 : 0 }}>
        <Avatar
          src={person.avatar}
          sx={
            isParentLevel
              ? { width: 64, height: 64, border: 2, borderColor: 'rgba(205, 229, 255, 0.5)' }
              : { width: level === 'grandparent' ? 56 : 48, height: level === 'grandparent' ? 56 : 48 }
          }
        />
        <Box>
          <Typography
            variant={isParentLevel ? 'h5' : 'h6'}
            sx={{
              fontFamily: 'var(--font-newsreader), serif',
              color: isParentLevel ? 'white' : 'primary.main',
              fontSize: level === 'child' ? '1.125rem' : undefined,
            }}
          >
            {person.name}
          </Typography>
          <Typography variant={isParentLevel ? 'body2' : 'caption'} sx={{ color: isParentLevel ? 'rgba(255,255,255,0.7)' : 'secondary.main', fontWeight: 500 }}>
            {isParentLevel ? `${person.role} • ${person.memories || 0} Memories` : person.role}
          </Typography>
        </Box>
      </Box>

      {isParentLevel && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              fullWidth
              variant="text"
              startIcon={<AutoStories />}
              onClick={(e) => { e.stopPropagation(); onViewArchive(person) }}
              sx={{ flex: 2, color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }, justifyContent: 'center', py: 1, borderRadius: 2 }}
            >
              Open Story
            </Button>
            {isSelf && onToggleSiblings && (
              <Button
                variant="text"
                onClick={(e) => { e.stopPropagation(); onToggleSiblings() }}
                sx={{ 
                  flex: 1, 
                  color: 'white', 
                  bgcolor: includeSiblings ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)', 
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }, 
                  justifyContent: 'center', 
                  py: 1, 
                  borderRadius: 2,
                  minWidth: 0,
                  px: 0
                }}
                title={includeSiblings ? "Hide Siblings" : "Show Siblings"}
              >
                <PeopleIcon />
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="text" startIcon={<Edit />}
              onClick={(e) => { e.stopPropagation(); onPersonClick(person) }}
              sx={{ flex: 1, color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }, justifyContent: 'center', py: 1, borderRadius: 2 }}
            >
              Edit
            </Button>
            {onSetRoot && !isSelf && (
              <Button variant="text" startIcon={<TreeIcon />}
                onClick={(e) => { e.stopPropagation(); onSetRoot(String(person.id)) }}
                sx={{ flex: 1, color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }, justifyContent: 'center', py: 1, borderRadius: 2 }}
              >
                Focus
              </Button>
            )}
            <Button variant="text" startIcon={<PersonAdd />}
              onClick={(e) => { e.stopPropagation(); onAddPerson() }}
              sx={{ flex: 1, color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }, justifyContent: 'center', py: 1, borderRadius: 2 }}
            >
              Add
            </Button>
          </Box>
        </Box>
      )}
    </Card>
  )
}
