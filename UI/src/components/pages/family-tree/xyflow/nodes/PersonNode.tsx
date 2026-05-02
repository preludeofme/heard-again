import React from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { FamilyMemberCard } from '../../FamilyMemberCard'
import type { PersonNodeData } from '../types'

export function PersonNode({ data }: NodeProps): React.JSX.Element {
  // NodeProps.data is typed as Record<string,unknown> by @xyflow/react — cast is safe here
  // because we control what we put in via layout.ts
  const d = data as unknown as PersonNodeData

  return (
    <>
      <Handle type="target" id="top" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" id="top" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="target" id="left" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" id="left" position={Position.Left} style={{ opacity: 0 }} />
      <FamilyMemberCard
        person={d.person}
        level={d.level}
        isSelf={d.isSelf}
        cardWidth={d.person.width}
        isMobile={d.isMobile}
        onPersonClick={d.onPersonClick}
        onAddPerson={d.onAddPerson}
        onViewArchive={d.onViewArchive}
        onSetRoot={d.onSetRoot}
      />
      <Handle type="source" id="bottom" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" id="bottom" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="source" id="right" position={Position.Right} style={{ opacity: 0 }} />
      <Handle type="target" id="right" position={Position.Right} style={{ opacity: 0 }} />
    </>
  )
}
