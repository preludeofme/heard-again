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
  isSelected?: boolean
  levelIndex?: number
  cardWidth: number
  isMobile: boolean
  onPersonClick: (person: TreePerson) => void
  onAddPerson: () => void
  onViewArchive: (person: TreePerson) => void
  onToggleSiblings?: () => void
  onSetRoot?: (id: string) => void
  onEditRelationships?: (personId: string) => void
  includeSiblings?: boolean
  compact?: boolean
}

export function FamilyMemberCard({
  person,
  level,
  isSelf,
  isSelected,
  levelIndex = 0,
  cardWidth,
  isMobile,
  onPersonClick,
  onAddPerson,
  onViewArchive,
  onToggleSiblings: _onToggleSiblings,
  onSetRoot,
  onEditRelationships,
  includeSiblings: _includeSiblings,
  compact = false,
}: FamilyMemberCardProps) {
  const selfCardColor = '#1a6b5a'
  const selectedColor = '#7b1fa2' // Deep Purple for selected
  const levelColors = ['#16334a', '#445558', '#6d5f44']
  
  const selfCardOutline = 'rgba(26, 107, 90, 0.08)'

  const getLifeSpan = () => {
    const getYear = (dateStr?: string | null) => {
      if (!dateStr) return null;
      const match = dateStr.match(/\d{4}/);
      return match ? match[0] : null;
    };
    const bYear = getYear(person.birthDate);
    const dYear = getYear(person.deathDate);
    
    if (bYear && dYear) return `${bYear} - ${dYear}`;
    if (bYear) return `b. ${bYear}`;
    if (dYear) return `d. ${dYear}`;
    return null;
  }
  const lifeSpan = getLifeSpan();

  const isParentLevel = level === 'parent'

  // Color logic
  let cardBgColor = levelColors[levelIndex % 3]
  if (isSelf) cardBgColor = selfCardColor
  if (isSelected) cardBgColor = selectedColor

  // Compact mode: avatar, name, life span and icons
  if (compact) {
    return (
      <Card
        tabIndex={0}
        onClick={() => onPersonClick(person)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPersonClick(person) } }}
        sx={{
          bgcolor: cardBgColor,
          p: 1.5,
          borderRadius: 4,
          width: cardWidth,
          cursor: 'pointer',
          boxShadow: isSelected ? '0 0 0 4px rgba(123, 31, 162, 0.3), 0 12px 24px rgba(0,0,0,0.2)' : '0 8px 20px rgba(0,0,0,0.12)',
          border: isSelected ? '2px solid white' : 'none',
          outline: isSelf ? `4px solid ${selfCardOutline}` : 'none',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          transition: 'all 0.3s ease',
          '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 30px rgba(0,0,0,0.2)' },
        }}
      >
        <Avatar
          src={person.avatar}
          sx={{
            width: isParentLevel ? 64 : 52,
            height: isParentLevel ? 64 : 52,
            flexShrink: 0,
            border: '2px solid rgba(255,255,255,0.4)',
          }}
        />

        <Box sx={{ textAlign: 'center', width: '100%', px: 1 }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-newsreader), serif',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 600,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.2,
              minHeight: '2.4em', // Reserved space for up to 2 lines
            }}
          >
            {person.name}
          </Typography>
          {lifeSpan && (
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'rgba(255,255,255,0.85)', 
                fontSize: '0.75rem',
                display: 'block',
                mt: 0.5,
                fontWeight: 500
              }}
            >
              {lifeSpan}
            </Typography>
          )}
        </Box>
        
        <Box
          sx={{
            pt: 1.5,
            pb: 0.5,
            borderTop: '1px solid rgba(255,255,255,0.15)',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            width: '100%',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              size="small"
              className="nodrag"
              onClick={(e) => { e.stopPropagation(); onViewArchive(person) }}
              sx={{ color: 'rgba(255,255,255,0.85)', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', color: 'white' } }}
            >
              <AutoStories sx={{ fontSize: 18 }} />
            </IconButton>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase' }}>Story</Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              size="small"
              className="nodrag"
              onClick={(e) => { e.stopPropagation(); onPersonClick(person) }}
              sx={{ color: 'rgba(255,255,255,0.85)', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', color: 'white' } }}
            >
              <Edit sx={{ fontSize: 18 }} />
            </IconButton>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase' }}>Edit</Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            {onSetRoot && !isSelf ? (
              <>
                <IconButton
                  size="small"
                  className="nodrag"
                  onClick={(e) => { e.stopPropagation(); onSetRoot(String(person.id)) }}
                  sx={{ color: 'rgba(255,255,255,0.85)', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', color: 'white' } }}
                >
                  <TreeIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase' }}>Focus</Typography>
              </>
            ) : (
              <>
                <IconButton
                  size="small"
                  disabled
                  sx={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  <TreeIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase' }}>Focus</Typography>
              </>
            )}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              size="small"
              className="nodrag"
              onClick={(e) => { e.stopPropagation(); onEditRelationships ? onEditRelationships(String(person.id)) : onAddPerson() }}
              sx={{ color: 'rgba(255,255,255,0.85)', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', color: 'white' } }}
            >
              <PeopleIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase' }}>Kin</Typography>
          </Box>
        </Box>
      </Card>
    )
  }

  // Mobile: compact card — tap opens detail modal; no inline action buttons
  if (isMobile) {
    const avatarSize = isParentLevel ? 36 : level === 'grandparent' ? 30 : 28
    return (
      <Card
        tabIndex={0}
        onClick={() => onPersonClick(person)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPersonClick(person) } }}
        sx={{
          bgcolor: cardBgColor,
          p: 1.5,
          borderRadius: isParentLevel ? 4 : 3,
          width: cardWidth,
          cursor: 'pointer',
          boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
          border: 'none',
          outline: isSelf ? `4px solid ${selfCardOutline}` : 'none',
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
              border: '1.5px solid rgba(255,255,255,0.4)',
            }}
          />
          <Box sx={{ overflow: 'hidden', minWidth: 0 }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-newsreader), serif',
                fontSize: isParentLevel ? '0.8rem' : '0.72rem',
                fontWeight: 600,
                color: 'white',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.2,
              }}
            >
              {person.name}
            </Typography>
            {lifeSpan && (
              <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1, mb: 0.25 }}>
                {lifeSpan}
              </Typography>
            )}
          </Box>
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
      sx={{
        bgcolor: cardBgColor,
        p: isParentLevel ? 4 : 3,
        borderRadius: isParentLevel ? 6 : 4,
        width: cardWidth,
        position: 'relative',
        boxShadow: isSelf
          ? '0 20px 25px -5px rgba(26, 107, 90, 0.18)'
          : '0 20px 25px -5px rgba(0,0,0,0.1)',
        outline: isSelf ? 8 : 1,
        outlineColor: isSelf ? selfCardOutline : 'rgba(255, 255, 255, 0.05)',
        border: 'none',
        cursor: 'pointer',
        transition: 'transform 0.3s',
        '&:hover': { transform: 'translateY(-4px)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: isParentLevel ? 3 : 0 }}>
        <Avatar
          src={person.avatar}
          sx={{ 
            width: isParentLevel ? 64 : 52, 
            height: isParentLevel ? 64 : 52, 
            border: 2, 
            borderColor: 'rgba(255, 255, 255, 0.4)' 
          }}
        />
        <Box>
          <Typography
            variant={isParentLevel ? 'h5' : 'h6'}
            sx={{
              fontFamily: 'var(--font-newsreader), serif',
              color: 'white',
              fontSize: level === 'child' ? '1.125rem' : undefined,
            }}
          >
            {person.name}
          </Typography>
          {lifeSpan && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', display: 'block', mb: 0.25 }}>
              {lifeSpan}
            </Typography>
          )}
          <Typography variant={isParentLevel ? 'body2' : 'caption'} sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
            {isParentLevel ? `${person.role} • ${person.memories || 0} Memories` : person.role}
          </Typography>
        </Box>
      </Box>

      {isParentLevel ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              fullWidth
              className="nodrag"
              variant="text"
              startIcon={<AutoStories />}
              onClick={(e) => { e.stopPropagation(); onViewArchive(person) }}
              sx={{ flex: 2, color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }, justifyContent: 'center', py: 1, borderRadius: 2 }}
            >
              Open Story
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="text" startIcon={<Edit />} className="nodrag"
              onClick={(e) => { e.stopPropagation(); onPersonClick(person) }}
              sx={{ flex: 1, color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }, justifyContent: 'center', py: 1, borderRadius: 2 }}
            >
              Edit
            </Button>
            {onSetRoot && !isSelf && (
              <Button variant="text" startIcon={<TreeIcon />} className="nodrag"
                onClick={(e) => { e.stopPropagation(); onSetRoot(String(person.id)) }}
                sx={{ flex: 1, color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }, justifyContent: 'center', py: 1, borderRadius: 2 }}
              >
                Focus
              </Button>
            )}
            <Button variant="text" startIcon={<PeopleIcon />} className="nodrag"
              onClick={(e) => { e.stopPropagation(); onEditRelationships ? onEditRelationships(String(person.id)) : onAddPerson() }}
              sx={{ flex: 1, color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }, justifyContent: 'center', py: 1, borderRadius: 2 }}
            >
              Relatives
            </Button>
            <Button variant="text" startIcon={<PersonAdd />} className="nodrag"
              onClick={(e) => { e.stopPropagation(); onAddPerson() }}
              sx={{ flex: 1, color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }, justifyContent: 'center', py: 1, borderRadius: 2 }}
            >
              Add
            </Button>
          </Box>
        </Box>
      ) : (
        /* Compact action row for grandparent / child level cards */
        <Box
          sx={{
            mt: 1.5,
            pt: 1.5,
            borderTop: '1.5px solid rgba(255,255,255,0.15)',
            display: 'flex',
            gap: 0.5,
          }}
        >
          <IconButton
            size="small"
            className="nodrag"
            title="Stories"
            onClick={(e) => { e.stopPropagation(); onViewArchive(person) }}
            sx={{ flex: 1, borderRadius: 1.5, color: 'rgba(255,255,255,0.7)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: 'white' } }}
          >
            <AutoStories sx={{ fontSize: 15 }} />
          </IconButton>
          <IconButton
            size="small"
            className="nodrag"
            title="Edit"
            onClick={(e) => { e.stopPropagation(); onPersonClick(person) }}
            sx={{ flex: 1, borderRadius: 1.5, color: 'rgba(255,255,255,0.7)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: 'white' } }}
          >
            <Edit sx={{ fontSize: 15 }} />
          </IconButton>
          {onSetRoot && !isSelf && (
            <IconButton
              size="small"
              className="nodrag"
              title="Focus"
              onClick={(e) => { e.stopPropagation(); onSetRoot(String(person.id)) }}
              sx={{ flex: 1, borderRadius: 1.5, color: 'rgba(255,255,255,0.7)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: 'white' } }}
            >
              <TreeIcon sx={{ fontSize: 15 }} />
            </IconButton>
          )}
          <IconButton
            size="small"
            className="nodrag"
            title="Relatives"
            onClick={(e) => { e.stopPropagation(); onEditRelationships ? onEditRelationships(String(person.id)) : onAddPerson() }}
            sx={{ flex: 1, borderRadius: 1.5, color: 'rgba(255,255,255,0.7)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: 'white' } }}
          >
            <PeopleIcon sx={{ fontSize: 15 }} />
          </IconButton>
          <IconButton
            size="small"
            className="nodrag"
            title="Add Person"
            onClick={(e) => { e.stopPropagation(); onAddPerson() }}
            sx={{ flex: 1, borderRadius: 1.5, color: 'rgba(255,255,255,0.7)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: 'white' } }}
          >
            <PersonAdd sx={{ fontSize: 15 }} />
          </IconButton>
        </Box>
      )}
    </Card>
  )
}
