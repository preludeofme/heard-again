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
import { StubNode } from './nodes/StubNode'
import { buildFamilyTreeLayout } from './layout'
import type { ApiPersonWithEdges, TreeLayoutPerson } from './types'

const nodeTypes: NodeTypes = {
  personNode: PersonNode as NodeTypes[string],
  familyNode: FamilyNode as NodeTypes[string],
  stubNode: StubNode as NodeTypes[string],
}

export interface ReactFlowTreeCanvasHandle {
  zoomIn: () => void
  zoomOut: () => void
  resetView: () => void
  fitView: (options?: { duration?: number; padding?: number }) => void
  centerOnNode: (nodeId: string, options?: { duration?: number; zoom?: number }) => void
}

interface ReactFlowTreeCanvasProps {
  people: ApiPersonWithEdges[]
  rootPersonId: string
  selectedPersonId?: string | null
  isMobile?: boolean
  canvasRef?: React.Ref<ReactFlowTreeCanvasHandle>
  onPersonClick: (person: TreeLayoutPerson) => void
  onAddPerson: () => void
  onViewArchive: (person: TreeLayoutPerson) => void
  onSetRoot?: (id: string) => void
  onLoadMore?: (direction: 'up' | 'down', personId: string) => void
  onEditRelationships?: (personId: string) => void
  isPanMode?: boolean
  fitViewTrigger?: number
}

// Inner component — must be inside ReactFlowProvider to use useReactFlow
function ReactFlowTreeCanvasInner({
  people,
  rootPersonId,
  selectedPersonId = null,
  isMobile = false,
  canvasRef,
  onPersonClick,
  onAddPerson,
  onViewArchive,
  onSetRoot,
  onLoadMore,
  onEditRelationships,
  isPanMode = true,
  fitViewTrigger,
}: ReactFlowTreeCanvasProps): React.JSX.Element {
  const { zoomIn, zoomOut, fitView, setCenter, getNodes } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Keep a stable ref to callbacks to avoid re-running layout when parent re-renders
  const callbacksRef = useRef({ onPersonClick, onAddPerson, onViewArchive, onSetRoot, onLoadMore, onEditRelationships, isMobile })
  callbacksRef.current = { onPersonClick, onAddPerson, onViewArchive, onSetRoot, onLoadMore, onEditRelationships, isMobile }

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
      selectedPersonId,
    )

    setNodes(newNodes)
    setEdges(newEdges)
  }, [people, rootPersonId, selectedPersonId, setNodes, setEdges])

  // Expose zoom/pan controls via ref
  React.useImperativeHandle(
    canvasRef,
    () => ({
      zoomIn: () => zoomIn({ duration: 200 }),
      zoomOut: () => zoomOut({ duration: 200 }),
      resetView: () => fitView({ duration: 300, padding: 0.15 }),
      fitView: (options) => fitView({ duration: 300, padding: 0.15, ...options }),
      centerOnNode: (nodeId, options) => {
        const node = getNodes().find((n) => n.id === nodeId)
        if (node) {
          const x = node.position.x + (node.measured?.width ?? 0) / 2
          const y = node.position.y + (node.measured?.height ?? 0) / 2
          setCenter(x, y, { duration: options?.duration ?? 300, zoom: options?.zoom ?? 1 })
        }
      },
    }),
    [zoomIn, zoomOut, fitView, setCenter, getNodes],
  )

  // Fit view when explicitly triggered (e.g. after GEDCOM import loads new nodes)
  useEffect(() => {
    if (!fitViewTrigger) return
    // Delay lets React Flow finish measuring the newly laid-out nodes
    const t = setTimeout(() => fitView({ duration: 500, padding: 0.15 }), 150)
    return () => clearTimeout(t)
  }, [fitViewTrigger, fitView])

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
      elementsSelectable={true}
      nodesFocusable={false}
      panOnScroll={false}
      zoomOnScroll={true}
      panOnDrag={isPanMode}
      onlyRenderVisibleElements={true}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
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
      <div style={{ width: '100%', height: '100%' }}>
        <ReactFlowTreeCanvasInner {...props} />
      </div>
    </ReactFlowProvider>
  )
}
