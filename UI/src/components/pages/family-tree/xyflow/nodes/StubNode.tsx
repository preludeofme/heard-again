import React from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

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
      case 'up': return 'Load Parents'
      case 'down': return 'Load Children'
      case 'left':
      case 'right': return 'Load Siblings'
      default: return 'Load Branch'
    }
  }

  const getRotation = () => {
    switch (d.direction) {
      case 'up': return 'none'
      case 'down': return 'rotate(180deg)'
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
      <div
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
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          width: '100%',
          height: '100%',
          borderRadius: 20,
          border: '1.5px dashed rgba(22, 51, 74, 0.35)',
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(8px)',
          cursor: 'pointer',
          boxSizing: 'border-box',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.background = 'rgba(22, 51, 74, 0.06)'
          el.style.borderColor = 'rgba(22, 51, 74, 0.55)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.background = 'rgba(255, 255, 255, 0.88)'
          el.style.borderColor = 'rgba(22, 51, 74, 0.35)'
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(22,51,74,0.55)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: getRotation(), flexShrink: 0 }}
        >
          <polyline points="7 13 12 18 17 13" />
          <polyline points="7 6 12 11 17 6" />
        </svg>
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 600,
            color: 'rgba(22, 51, 74, 0.6)',
            whiteSpace: 'nowrap',
            letterSpacing: '0.02em',
          }}
        >
          {getLabel()}
        </span>
      </div>
      <Handle type="source" id="bottom" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" id="bottom" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="source" id="right" position={Position.Right} style={{ opacity: 0 }} />
      <Handle type="target" id="right" position={Position.Right} style={{ opacity: 0 }} />
    </>
  )
}
