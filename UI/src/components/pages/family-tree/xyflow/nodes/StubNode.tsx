import React from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Box, Typography } from '@mui/material'
import { 
  KeyboardDoubleArrowDown as ArrowIcon 
} from '@mui/icons-material'

interface StubNodeData {
  targetId: string
  direction: 'up' | 'down' | 'left' | 'right'
  onSetRoot?: (id: string) => void
  onLoadMore?: (direction: 'up' | 'down' | 'left' | 'right', personId: string) => void
}

export function StubNode({ data }: NodeProps): React.JSX.Element {
  const d = data as unknown as StubNodeData

  const handleClick = () => {
    if (d.onLoadMore) {
      d.onLoadMore(d.direction, d.targetId)
    } else {
      d.onSetRoot?.(d.targetId)
    }
  }

  const getLabel = () => {
    switch (d.direction) {
      case 'up': return 'Parents'
      case 'down': return 'Children'
      case 'left':
      case 'right': return 'Siblings'
      default: return 'Branch'
    }
  }

  const getRotation = () => {
    switch (d.direction) {
      case 'up': return 'rotate(180deg)'
      case 'down': return 'none'
      case 'left': return 'rotate(90deg)'
      case 'right': return 'rotate(-90deg)'
      default: return 'none'
    }
  }

  return (
    <>
      <Handle type="target" id="top" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" id="top" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="target" id="left" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" id="left" position={Position.Left} style={{ opacity: 0 }} />
      <Box
        role="button"
        tabIndex={0}
        className="nodrag nopan"
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          width: '100%',
          height: '100%',
          borderRadius: 20,
          border: '1.5px solid rgba(22, 51, 74, 0.15)',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(8px)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          '&:hover': {
            background: 'white',
            borderColor: 'primary.main',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            transform: 'scale(1.02)',
          }
        }}
      >
        <ArrowIcon 
          sx={{ 
            fontSize: 18, 
            color: 'primary.main',
            transform: getRotation() 
          }} 
        />
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: 'primary.main',
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
            textTransform: 'uppercase',
          }}
        >
          {getLabel()}
        </Typography>
      </Box>
      <Handle type="source" id="bottom" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" id="bottom" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="source" id="right" position={Position.Right} style={{ opacity: 0 }} />
      <Handle type="target" id="right" position={Position.Right} style={{ opacity: 0 }} />
    </>
  )
}
