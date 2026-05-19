import React, { useEffect, useRef, useState, useMemo } from 'react'
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
import { useRealtimeRun } from '@trigger.dev/react-hooks'
import { toPng } from 'html-to-image'
import { PersonNode } from './nodes/PersonNode'
import { FamilyNode } from './nodes/FamilyNode'
import { StubNode } from './nodes/StubNode'
import { buildFamilyTreeLayout } from './layout'
import type { ApiPersonWithEdges, TreeLayoutPerson } from './types'
import type { exportTreeTask } from '@/trigger/export-tree-task'

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
  forExport?: boolean
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
  forExport = false,
}: ReactFlowTreeCanvasProps): React.JSX.Element {
  const { zoomIn, zoomOut, fitView, setCenter, getNodes } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportRunId, setExportRunId] = useState<string | null>(null)
  const [exportPublicToken, setExportPublicToken] = useState<string | null>(null)
  const [exportTriggerApiUrl, setExportTriggerApiUrl] = useState<string | null>(null)
  const flowContainerRef = useRef<HTMLDivElement>(null)

  const { run: exportRun } = useRealtimeRun<typeof exportTreeTask>(exportRunId ?? '', {
    accessToken: exportPublicToken ?? '',
    baseURL: exportTriggerApiUrl ?? undefined,
    enabled: !!exportRunId && !!exportPublicToken,
  })

  useEffect(() => {
    if (!exportRun) return

    if (exportRun.status === 'COMPLETED') {
      const url = (exportRun.output as { downloadUrl?: string } | undefined)?.downloadUrl
      if (url) {
        const link = document.createElement('a')
        link.href = url
        link.download = 'family-tree.png'
        link.click()
      }
      setIsExporting(false)
      setExportRunId(null)
      setExportPublicToken(null)
      setExportTriggerApiUrl(null)
    }

    if (['FAILED', 'CRASHED', 'TIMED_OUT', 'CANCELED'].includes(exportRun.status)) {
      console.error('Export run ended with status:', exportRun.status)
      alert('Export failed. Please try again.')
      setIsExporting(false)
      setExportRunId(null)
      setExportPublicToken(null)
      setExportTriggerApiUrl(null)
    }
  }, [exportRun])

  const highlightedEdges = useMemo(() => {
    if (!hoveredNodeId) return edges

    const edgesToHighlight = new Set<string>()
    const familyNodes = new Set<string>()

    // First pass: find directly connected edges and family nodes
    for (const edge of edges) {
      if (edge.source === hoveredNodeId) {
        edgesToHighlight.add(edge.id)
        if (edge.target.startsWith('family::')) {
          familyNodes.add(edge.target)
        }
      }
      if (edge.target === hoveredNodeId) {
        edgesToHighlight.add(edge.id)
        if (edge.source.startsWith('family::')) {
          familyNodes.add(edge.source)
        }
      }
    }

    // Second pass: find edges connected to the relevant family nodes
    for (const edge of edges) {
      if (familyNodes.has(edge.source) || familyNodes.has(edge.target)) {
        edgesToHighlight.add(edge.id)
      }
    }

    return edges.map(edge => {
      if (edgesToHighlight.has(edge.id)) {
        return {
          ...edge,
          style: {
            ...edge.style,
            strokeWidth: ((edge.style?.strokeWidth as number) || 3) + 2,
            opacity: 1,
            filter: 'drop-shadow(0 0 5px rgba(0,0,0,0.3))'
          },
          zIndex: 1000
        }
      }
      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: 0.15
        },
        zIndex: 0
      }
    })
  }, [edges, hoveredNodeId])

  const highlightedNodes = useMemo(() => {
    if (!hoveredNodeId) return nodes

    const nodesToHighlight = new Set<string>()
    nodesToHighlight.add(hoveredNodeId)

    // Find connected nodes
    const familyNodes = new Set<string>()
    for (const edge of edges) {
      if (edge.source === hoveredNodeId) {
        if (edge.target.startsWith('family::')) familyNodes.add(edge.target)
        else nodesToHighlight.add(edge.target)
      }
      if (edge.target === hoveredNodeId) {
        if (edge.source.startsWith('family::')) familyNodes.add(edge.source)
        else nodesToHighlight.add(edge.source)
      }
    }

    for (const edge of edges) {
      if (familyNodes.has(edge.source)) nodesToHighlight.add(edge.target)
      if (familyNodes.has(edge.target)) nodesToHighlight.add(edge.source)
    }

    return nodes.map(node => {
      if (node.type === 'familyNode' || node.type === 'stubNode') return node

      const isHighlighted = nodesToHighlight.has(node.id)

      return {
        ...node,
        data: {
          ...node.data,
          isDimmed: !isHighlighted
        }
      }
    })
  }, [nodes, edges, hoveredNodeId])

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
        setIsExporting(true)
        try {
          const res = await fetch('/api/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rootId: rootPersonId }),
          })
          const data = await res.json() as { success: boolean; runId?: string; publicAccessToken?: string; triggerApiUrl?: string; error?: string }
          if (!data.success || !data.runId || !data.publicAccessToken) {
            throw new Error(data.error ?? 'Failed to queue export.')
          }
          setExportRunId(data.runId)
          setExportPublicToken(data.publicAccessToken)
          if (data.triggerApiUrl) setExportTriggerApiUrl(data.triggerApiUrl)
          // isExporting stays true — useRealtimeRun effect clears it when the run finishes
        } catch (err) {
          console.error('Failed to export PNG:', err)
          alert('Failed to export PNG. Please try again.')
          setIsExporting(false)
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
    <div ref={flowContainerRef} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={highlightedNodes}
        edges={highlightedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId(null)}
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
        onlyRenderVisibleElements={!isExporting && !forExport} // MUST be false during export so html-to-image/puppeteer can clone off-screen nodes
        style={{ width: '100%', height: '100%', background: forExport ? 'rgb(246, 243, 238)' : 'transparent' }}
      >
        {!forExport && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="rgba(22, 51, 74, 0.06)"
          />
        )}
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
