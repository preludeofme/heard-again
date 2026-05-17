import React, { useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  getNodesBounds,
  getViewportForBounds,
  type NodeTypes,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toPng } from 'html-to-image'
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
  exportPng: () => Promise<void>
}

interface ReactFlowTreeCanvasProps {
  people: ApiPersonWithEdges[]
  rootPersonId: string
  selectedPersonId?: string | null
  userPersonId?: string | null
  isMobile?: boolean
  canvasRef?: React.Ref<ReactFlowTreeCanvasHandle>
  onPersonClick: (person: TreeLayoutPerson) => void
  onAddPerson: (personId?: string) => void
  onViewMemories: (person: TreeLayoutPerson) => void
  onViewFullProfile?: (personId: string) => void
  onSetRoot?: (id: string) => void
  onLoadMore?: (direction: 'up' | 'down' | 'left' | 'right', personId: string) => void
  onEditRelationships?: (personId: string) => void
  isPanMode?: boolean
  fitViewTrigger?: number
}

// Inner component — must be inside ReactFlowProvider to use useReactFlow
function ReactFlowTreeCanvasInner({
  people,
  rootPersonId,
  selectedPersonId = null,
  userPersonId = null,
  isMobile = false,
  canvasRef,
  onPersonClick,
  onAddPerson,
  onViewMemories,
  onViewFullProfile,
  onSetRoot,
  onLoadMore,
  onEditRelationships,
  isPanMode = true,
  fitViewTrigger,
}: ReactFlowTreeCanvasProps): React.JSX.Element {
  const { zoomIn, zoomOut, fitView, setCenter, getNodes } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const flowContainerRef = useRef<HTMLDivElement>(null)

  // Keep a stable ref to callbacks to avoid re-running layout when parent re-renders
  const callbacksRef = useRef({ onPersonClick, onAddPerson, onViewMemories, onViewFullProfile, onSetRoot, onLoadMore, onEditRelationships, isMobile })
  callbacksRef.current = { onPersonClick, onAddPerson, onViewMemories, onViewFullProfile, onSetRoot, onLoadMore, onEditRelationships, isMobile }

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
      userPersonId,
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
      exportPng: async () => {
        const container = flowContainerRef.current
        if (!container) return

        const currentNodes = getNodes()
        if (currentNodes.length === 0) return

        const IMAGE_WIDTH = 3840
        const IMAGE_HEIGHT = 2160
        const bounds = getNodesBounds(currentNodes)
        const viewport = getViewportForBounds(bounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.1, 2, 0.15)

        const viewportEl = container.querySelector<HTMLElement>('.react-flow__viewport')
        if (!viewportEl) return

        const dataUrl = await toPng(viewportEl, {
          backgroundColor: 'rgb(246, 243, 238)',
          width: IMAGE_WIDTH,
          height: IMAGE_HEIGHT,
          style: {
            width: `${IMAGE_WIDTH}px`,
            height: `${IMAGE_HEIGHT}px`,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          },
        })

        const link = document.createElement('a')
        link.href = dataUrl
        link.download = 'family-tree.png'
        link.click()
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
    <div ref={flowContainerRef} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.04}
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
    </div>
  )
}

export function ReactFlowTreeCanvas(props: ReactFlowTreeCanvasProps): React.JSX.Element | null {
  // Zustand 4.x / xyflow hooks crash during the first render cycle after hydration
  // in React 19. Defer the inner render until the component is settled on the client.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  return (
    <ReactFlowProvider>
      <div style={{ width: '100%', height: '100%' }}>
        <ReactFlowTreeCanvasInner {...props} />
      </div>
    </ReactFlowProvider>
  )
}
