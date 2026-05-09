import React from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Box, Typography } from '@mui/material'
import { 
  KeyboardDoubleArrowLeft as SiblingLeftIcon,
  KeyboardDoubleArrowRight as SiblingRightIcon,
  KeyboardDoubleArrowUp as ParentIcon,
  KeyboardDoubleArrowDown as ChildIcon
} from '@mui/icons-material'
import { FamilyMemberCard } from '../../FamilyMemberCard'
import type { PersonNodeData } from '../types'

const STUB_BASE_STYLE = {
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  cursor: 'pointer',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  zIndex: 5,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
}

export function PersonNode({ data }: NodeProps): React.JSX.Element {
  const d = data as unknown as PersonNodeData

  // Match the card's background color logic
  const selfCardColor = '#1a6b5a'
  const primaryMain = '#16334a' 
  
  const cardBgColor = d.isSelf ? selfCardColor : primaryMain
  
  const iconColor = '#ffffff'
  const textColor = '#ffffff'
  const borderColor = 'rgba(255, 255, 255, 0.1)'

  const handleLoad = (direction: 'up' | 'down' | 'left' | 'right') => (e: React.MouseEvent) => {
    e.stopPropagation()
    d.onLoadMore?.(direction, d.person.id)
  }

  return (
    <Box sx={{ position: 'relative', width: d.person.width, minHeight: d.person.height }}>
      {/* Integrated "Load" Buttons (Tabs) */}
      
      {/* Siblings - Left */}
      {d.missingLeft && (
        <Box 
          onClick={handleLoad('left')}
          sx={{
            ...STUB_BASE_STYLE,
            bgcolor: cardBgColor,
            border: `1.5px solid ${borderColor}`,
            left: -45, 
            top: '50%',
            transform: 'translateY(-50%)',
            width: 56, 
            height: 64,
            borderRadius: '32px 0 0 32px',
            borderRight: 'none',
            pl: 1.5,
            justifyContent: 'flex-start',
            color: iconColor,
            zIndex: 5,
            '&:hover': { 
              width: 110, 
              left: -99,
              borderColor: 'rgba(255,255,255,0.3)',
              zIndex: 15,
            }
          }}
        >
          <SiblingLeftIcon sx={{ fontSize: 24, flexShrink: 0 }} />
          <Typography 
            variant="caption" 
            sx={{ 
              fontSize: '0.65rem', 
              fontWeight: 800, 
              textTransform: 'uppercase', 
              lineHeight: 1.1,
              opacity: 0.8, 
              transition: 'opacity 0.2s', 
              color: textColor,
              textAlign: 'left',
              '.MuiBox-root:hover &': { opacity: 1 } 
            }}
          >
            Load<br/>Siblings
          </Typography>
        </Box>
      )}

      {/* Siblings - Right */}
      {d.missingRight && (
        <Box 
          onClick={handleLoad('right')}
          sx={{
            ...STUB_BASE_STYLE,
            bgcolor: cardBgColor,
            border: `1.5px solid ${borderColor}`,
            right: -45,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 56,
            height: 64,
            borderRadius: '0 32px 32px 0',
            borderLeft: 'none',
            pr: 1.5,
            justifyContent: 'flex-end',
            color: iconColor,
            zIndex: 5,
            '&:hover': { 
              width: 110,
              right: -99,
              borderColor: 'rgba(255,255,255,0.3)',
              zIndex: 15,
            }
          }}
        >
          <Typography 
            variant="caption" 
            sx={{ 
              fontSize: '0.65rem', 
              fontWeight: 800, 
              textTransform: 'uppercase', 
              lineHeight: 1.1,
              opacity: 0.8, 
              transition: 'opacity 0.2s', 
              color: textColor,
              textAlign: 'right',
              '.MuiBox-root:hover &': { opacity: 1 } 
            }}
          >
            Load<br/>Siblings
          </Typography>
          <SiblingRightIcon sx={{ fontSize: 24, flexShrink: 0 }} />
        </Box>
      )}

      {/* Children - Top (Point UP away from card) */}
      {d.missingDown && (
        <Box 
          onClick={handleLoad('down')}
          sx={{
            ...STUB_BASE_STYLE,
            bgcolor: cardBgColor,
            border: `1.5px solid ${borderColor}`,
            top: -35, 
            left: '50%',
            transform: 'translateX(-50%)',
            width: 100,
            height: 48,
            borderRadius: '24px 24px 0 0',
            borderBottom: 'none',
            pt: 0.5,
            color: iconColor,
            zIndex: 5,
            '&:hover': { 
              height: 64,
              top: -45, 
              width: 160,
              borderColor: 'rgba(255,255,255,0.3)',
              zIndex: 15,
            }
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <ParentIcon sx={{ fontSize: 22 }} />
            <Typography 
              variant="caption" 
              sx={{ 
                fontSize: '0.65rem', 
                fontWeight: 800, 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em',
                color: textColor,
                opacity: 0.8,
                transition: 'opacity 0.2s',
                '.MuiBox-root:hover &': { opacity: 1 }
              }}
            >
              Load Children
            </Typography>
          </Box>
        </Box>
      )}

      {/* Parents - Bottom (Point DOWN away from card) */}
      {d.missingUp && (
        <Box 
          onClick={handleLoad('up')}
          sx={{
            ...STUB_BASE_STYLE,
            bgcolor: cardBgColor,
            border: `1.5px solid ${borderColor}`,
            bottom: 35, 
            left: '50%',
            transform: 'translateX(-50%)',
            width: 100,
            height: 48,
            borderRadius: '0 0 24px 24px',
            borderTop: 'none',
            pb: 0.5,
            color: iconColor,
            zIndex: 5,
            '&:hover': { 
              height: 64,
              bottom: 10,
              width: 160,
              borderColor: 'rgba(255,255,255,0.3)',
              zIndex: 15,
            }
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <Typography 
              variant="caption" 
              sx={{ 
                fontSize: '0.65rem', 
                fontWeight: 800, 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em',
                color: textColor,
                opacity: 0.8,
                transition: 'opacity 0.2s',
                '.MuiBox-root:hover &': { opacity: 1 }
              }}
            >
              Load Parents
            </Typography>
            <ChildIcon sx={{ fontSize: 22 }} />
          </Box>
        </Box>
      )}

      <Box sx={{ position: 'relative', zIndex: 10 }}>
        <FamilyMemberCard
          person={d.person}
          level={d.level}
          isSelf={d.isSelf}
          isSelected={d.isSelected}
          levelIndex={d.levelIndex}
          cardWidth={d.person.width}
          isMobile={d.isMobile}
          onPersonClick={d.onPersonClick as any}
          onAddPerson={d.onAddPerson}
          onViewMemories={d.onViewMemories as any}
          onViewFullProfile={d.onViewFullProfile}
          onSetRoot={d.onSetRoot}
          onEditRelationships={d.onEditRelationships}
          compact={true}
        />
      </Box>
      
      {/* Handles at the end, lowest z-index and non-blocking */}
      <Handle type="target" id="top" position={Position.Top} style={{ opacity: 0, zIndex: 0, pointerEvents: 'none' }} />
      <Handle type="source" id="top" position={Position.Top} style={{ opacity: 0, zIndex: 0, pointerEvents: 'none' }} />
      <Handle type="target" id="left" position={Position.Left} style={{ opacity: 0, zIndex: 0, pointerEvents: 'none' }} />
      <Handle type="source" id="left" position={Position.Left} style={{ opacity: 0, zIndex: 0, pointerEvents: 'none' }} />
      <Handle type="source" id="right" position={Position.Right} style={{ opacity: 0, zIndex: 0, pointerEvents: 'none' }} />
      <Handle type="target" id="right" position={Position.Right} style={{ opacity: 0, zIndex: 0, pointerEvents: 'none' }} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={{ opacity: 0, zIndex: 0, pointerEvents: 'none' }} />
      <Handle type="target" id="bottom" position={Position.Bottom} style={{ opacity: 0, zIndex: 0, pointerEvents: 'none' }} />
    </Box>
  )
}
