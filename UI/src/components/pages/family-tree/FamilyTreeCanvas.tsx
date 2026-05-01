import React from 'react'
import {
  Box,
  Typography,
  Button,
} from '@mui/material'
import {
  Add,
  PersonAddOutlined as PersonAdd,
} from '@mui/icons-material'
import { EmptyState } from '@/components/feedback/UIStates'
import { FamilyMemberCard } from './FamilyMemberCard'
import { TreePerson, FamilyTreeData, CardPosition, ConnectorPath } from './types'

interface FamilyTreeCanvasProps {
  familyData: FamilyTreeData
  isFullscreen: boolean
  isMobile: boolean
  treeCanvasWidth: number
  treeFlowHeight: number
  zoomLevel: number
  panOffset: { x: number; y: number }
  toolMode: 'pointer' | 'hand'
  isDragging: boolean
  connectorPaths: ConnectorPath[]
  cardPositions: CardPosition[]
  onCanvasMouseDown: (e: React.MouseEvent) => void
  onCanvasMouseMove: (e: React.MouseEvent) => void
  onCanvasMouseUp: () => void
  onCanvasTouchStart: (e: React.TouchEvent) => void
  onCanvasTouchMove: (e: React.TouchEvent) => void
  onCanvasTouchEnd: () => void
  onPersonClick: (person: TreePerson) => void
  onAddPerson: () => void
  onViewArchive: (person: TreePerson) => void
}

export function FamilyTreeCanvas({
  familyData,
  isFullscreen,
  isMobile,
  treeCanvasWidth,
  treeFlowHeight,
  zoomLevel,
  panOffset,
  toolMode,
  isDragging,
  connectorPaths,
  cardPositions,
  onCanvasMouseDown,
  onCanvasMouseMove,
  onCanvasMouseUp,
  onCanvasTouchStart,
  onCanvasTouchMove,
  onCanvasTouchEnd,
  onPersonClick,
  onAddPerson,
  onViewArchive,
}: FamilyTreeCanvasProps) {
  const hasData = familyData.grandparents.length > 0 || 
                  familyData.parents.length > 0 || 
                  familyData.children.length > 0

  return (
    <Box
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onCanvasMouseMove}
      onMouseUp={onCanvasMouseUp}
      onMouseLeave={onCanvasMouseUp}
      onTouchStart={onCanvasTouchStart}
      onTouchMove={onCanvasTouchMove}
      onTouchEnd={onCanvasTouchEnd}
      onTouchCancel={onCanvasTouchEnd}
      sx={{
        position: 'relative',
        minHeight: isFullscreen ? 'calc(100vh - 140px)' : 700,
        width: '100%',
        bgcolor: 'rgba(208, 227, 230, 0.3)',
        borderRadius: 6,
        p: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        cursor: toolMode === 'hand' ? 'grab' : 'default',
        '&:active': toolMode === 'hand' ? { cursor: 'grabbing' } : {},
        userSelect: toolMode === 'hand' ? 'none' : 'auto',
        touchAction: 'none',
        backgroundImage: `
          radial-gradient(circle, rgba(22, 51, 74, 0.06) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px',
      }}
    >
      {!hasData ? (
        <Box sx={{ m: 'auto', p: 4, textAlign: 'center' }}>
          <EmptyState 
            type="documents"
            onAction={onAddPerson}
          />
          <Box sx={{ mt: -12, position: 'relative', zIndex: 1 }}>
            <Typography variant="h4" className="serif-font" sx={{ color: '#16334a', mb: 2 }}>
              Begin your family legacy
            </Typography>
            <Typography variant="body1" sx={{ color: '#546669', mb: 4, maxWidth: 400, mx: 'auto' }}>
              Your tree is currently a blank canvas. Add your first family member to start building a living story for the generations to come.
            </Typography>
            <Button 
              variant="contained" 
              size="large"
              onClick={onAddPerson}
              startIcon={<PersonAdd />}
              sx={{ bgcolor: '#16334a', borderRadius: 2, px: 4, py: 1.5 }}
            >
              Add First Family Member
            </Button>
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.2s ease',
            width: `max(${treeCanvasWidth + 80}px, 100%)`,
            minHeight: treeFlowHeight,
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              height: treeFlowHeight,
            }}
          >
            {/* SVG connector overlay */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              {connectorPaths.map((path) => (
                <path
                  key={path.id}
                  d={path.d}
                  stroke={path.stroke}
                  strokeWidth={path.strokeWidth}
                  strokeDasharray={path.strokeDasharray}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>

            {/* Absolutely positioned family member cards */}
            {cardPositions.map((card) => (
              <Box
                key={card.id}
                sx={{
                  position: 'absolute',
                  left: card.x,
                  top: card.y,
                  zIndex: 2,
                }}
              >
                <FamilyMemberCard
                  person={card.person}
                  level={card.level}
                  isSelf={card.person.selected}
                  cardWidth={card.width}
                  isMobile={isMobile}
                  onPersonClick={onPersonClick}
                  onAddPerson={onAddPerson}
                  onViewArchive={onViewArchive}
                />
              </Box>
            ))}
          </Box>

          {/* Add Relative Button */}
          <Box sx={{ mt: 6, cursor: 'pointer', display: 'flex', justifyContent: 'center' }} onClick={onAddPerson}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  bgcolor: 'rgba(208, 227, 230, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'secondary.main',
                  transition: 'all 0.3s',
                  '&:hover': {
                    bgcolor: 'primary.main',
                    color: 'white',
                  },
                }}
              >
                <Add />
              </Box>
              <Typography
                variant="caption"
                sx={{
                  mt: 1,
                  fontWeight: 700,
                  color: 'secondary.main',
                  opacity: 0.6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Add Relative
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )
}
