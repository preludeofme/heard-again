import React, { useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { PersonNode } from './nodes/PersonNode'
import { FamilyNode } from './nodes/FamilyNode'
import { buildFamilyTreeLayout } from './layout'
import type { ApiPersonWithEdges, TreeLayoutPerson } from './types'

const nodeTypes: NodeTypes = {
  personNode: PersonNode as NodeTypes[string],
  familyNode: FamilyNode as NodeTypes[string],
}

export interface ReactFlowTreeCanvasHandle {
  zoomIn: () => void
  zoomOut: () => void
  resetView: () => void
}

interface ReactFlowTreeCanvasProps {
  people: ApiPersonWithEdges[]
  rootPersonId: string
  isMobile?: boolean
  canvasRef?: React.Ref<ReactFlowTreeCanvasHandle>
  onPersonClick: (person: TreeLayoutPerson) => void
  onAddPerson: () => void
  onViewArchive: (person: TreeLayoutPerson) => void
  onSetRoot?: (id: string) => void
}

// Inner component — must be inside ReactFlowProvider to use useReactFlow
function ReactFlowTreeCanvasInner({
  people,
  rootPersonId,
  isMobile = false,
  canvasRef,
  onPersonClick,
  onAddPerson,
  onViewArchive,
  onSetRoot,
}: ReactFlowTreeCanvasProps): React.JSX.Element {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Keep a stable ref to callbacks to avoid re-running layout when parent re-renders
  const callbacksRef = useRef({ onPersonClick, onAddPerson, onViewArchive, onSetRoot, isMobile })
  callbacksRef.current = { onPersonClick, onAddPerson, onViewArchive, onSetRoot, isMobile }

  useEffect(() => {
    if (people.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    const { nodes: newNodes, edges: newEdges } = buildFamilyTreeLayout(
      people,
      rootPersonId,
      callbacksRef.current,
    )

    setNodes(newNodes)
    setEdges(newEdges)
  }, [people, rootPersonId, setNodes, setEdges])

  // Expose zoom/pan controls via ref
  React.useImperativeHandle(
    canvasRef,
    () => ({
      zoomIn: () => zoomIn({ duration: 200 }),
      zoomOut: () => zoomOut({ duration: 200 }),
      resetView: () => fitView({ duration: 300, padding: 0.15 }),
    }),
    [zoomIn, zoomOut, fitView],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.2}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll={false}
      zoomOnScroll={true}
      panOnDrag={true}
      style={{ background: 'transparent' }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="rgba(22, 51, 74, 0.06)"
      />
    </ReactFlow>
  )
}

export function ReactFlowTreeCanvas(props: ReactFlowTreeCanvasProps): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <ReactFlowTreeCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
