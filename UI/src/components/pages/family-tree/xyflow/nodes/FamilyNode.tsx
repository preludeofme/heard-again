import React from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

export function FamilyNode(_props: NodeProps): React.JSX.Element {
  return (
    <>
      <Handle type="target" id="top" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" id="top" position={Position.Top} style={{ opacity: 0 }} />
      <div style={{ width: 1, height: 1 }} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" id="bottom" position={Position.Bottom} style={{ opacity: 0 }} />
    </>
  )
}
