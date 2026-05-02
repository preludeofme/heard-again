import React from 'react'
import { Box, Typography, Button, Card, Avatar } from '@mui/material'
import { AutoStories, Edit, PersonAdd } from '@mui/icons-material'
import type { TreeLayoutPerson, TreeNodeLevel } from './xyflow/types'

const GRANDPARENT_CARD_WIDTH = 256
const PARENT_CARD_WIDTH = 288
const CHILD_CARD_WIDTH = 240

interface FamilyMemberCardProps {
  person: TreeLayoutPerson
  level: TreeNodeLevel
  isSelf?: boolean
  cardWidth?: number
  isMobile?: boolean
  onPersonClick: (person: TreeLayoutPerson) => void
  onAddPerson: () => void
  onViewArchive: (person: TreeLayoutPerson) => void
  onToggleSiblings?: () => void
  onSetRoot?: (id: string) => void
  includeSiblings?: boolean
}

export function FamilyMemberCard({
  person,
  level,
  isSelf,
  cardWidth: cardWidthProp,
  onPersonClick,
  onAddPerson,
  onViewArchive,
}: FamilyMemberCardProps): React.JSX.Element {
  const isParentLevel = level === 'parent'
  const cardWidth = cardWidthProp
    ?? (level === 'grandparent' ? GRANDPARENT_CARD_WIDTH : level === 'parent' ? PARENT_CARD_WIDTH : CHILD_CARD_WIDTH)

  const selfCardColor = '#1a6b5a'
  const selfCardOutline = 'rgba(26, 107, 90, 0.08)'

  return (
    <Card
      onClick={() => onPersonClick(person)}
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
              ? {
                width: 64,
                height: 64,
                border: 2,
                borderColor: 'rgba(205, 229, 255, 0.5)',
              }
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
          <Typography
            variant={isParentLevel ? 'body2' : 'caption'}
            sx={{ color: isParentLevel ? 'rgba(255,255,255,0.7)' : 'secondary.main', fontWeight: 500 }}
          >
            {isParentLevel ? `${person.role} • ${person.memories ?? 0} Memories` : person.role}
          </Typography>
        </Box>
      </Box>

      {isParentLevel && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            fullWidth
            variant="text"
            startIcon={<AutoStories />}
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation()
              onViewArchive(person)
            }}
            sx={{
              color: 'white',
              bgcolor: 'rgba(255,255,255,0.1)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              justifyContent: 'center',
              py: 1,
              borderRadius: 2,
            }}
          >
            View Archive
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="text"
              startIcon={<Edit />}
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation()
                onPersonClick(person)
              }}
              sx={{
                flex: 1,
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.1)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                justifyContent: 'center',
                py: 1,
                borderRadius: 2,
              }}
            >
              Edit
            </Button>
            <Button
              variant="text"
              startIcon={<PersonAdd />}
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation()
                onAddPerson()
              }}
              sx={{
                flex: 1,
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.1)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                justifyContent: 'center',
                py: 1,
                borderRadius: 2,
              }}
            >
              Add
            </Button>
          </Box>
        </Box>
      )}
    </Card>
  )
}
