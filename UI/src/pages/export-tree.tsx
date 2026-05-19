import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { Box, CircularProgress, GlobalStyles } from '@mui/material'
import dynamic from 'next/dynamic'

// @xyflow/react is browser-only
const ReactFlowTreeCanvas = dynamic(
  () => import('@/components/pages/family-tree/xyflow/ReactFlowTreeCanvas').then((m) => m.ReactFlowTreeCanvas),
  { ssr: false, loading: () => <CircularProgress sx={{ position: 'absolute', top: '50%', left: '50%', translate: '-50% -50%' }} /> },
)

import { fetchWithCSRF } from '@/lib/api-client'

export default function ExportTreePage() {
  const router = useRouter()
  const [people, setPeople] = useState<any[]>([])
  const [rawPeople, setRawPeople] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const rootPersonId = typeof router.query.rootId === 'string' ? router.query.rootId : undefined

  useEffect(() => {
    if (!router.isReady) return

    const fetchTree = async () => {
      try {
        // Fetch massive tree with huge depth to ensure full coverage
        const rootParam = rootPersonId ? `&rootPersonId=${rootPersonId}` : ''
        const res = await fetch(`/api/people/family-tree?depthUp=99&depthDown=99&includeSiblings=true${rootParam}`)
        const data = await res.json()
        
        if (data.success && data.data) {
          const basePeople = data.data.map(({ relationshipEdges, ...person }: any) => person)
          setPeople(basePeople)
          setRawPeople(data.data)
        }
      } catch (err) {
        console.error('Failed to load tree for export:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTree()
  }, [router.isReady, rootPersonId])

  // After rendering, we need to extract the bounds and signal Puppeteer
  useEffect(() => {
    if (isLoading || rawPeople.length === 0) return

    // Give React Flow a moment to layout
    const timer = setTimeout(() => {
      const viewport = document.querySelector('.react-flow__viewport')
      if (viewport) {
        // Calculate precise DOM bounds
        const nodes = Array.from(viewport.querySelectorAll('.react-flow__node'))
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity

        nodes.forEach((node) => {
          const transform = (node as HTMLElement).style.transform
          const match = transform.match(/translate\(([^p]+)px,\s*([^p]+)px\)/)
          if (match) {
            const x = parseFloat(match[1])
            const y = parseFloat(match[2])
            const rect = node.getBoundingClientRect()
            const w = rect.width || 220
            const h = rect.height || 300
            
            if (x < minX) minX = x
            if (y < minY) minY = y
            if (x + w > maxX) maxX = x + w
            if (y + h > maxY) maxY = y + h
          }
        })

        if (minX !== Infinity) {
          const bounds = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          }
          ;(window as any).TREE_BOUNDS = bounds
        }
      }
      
      ;(window as any).IS_TREE_READY = true
    }, 2000) // generous layout wait

    return () => clearTimeout(timer)
  }, [isLoading, rawPeople])

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
  }

  return (
    <>
      <GlobalStyles styles={{
        body: { margin: 0, padding: 0, background: 'rgb(246, 243, 238)', overflow: 'hidden' },
      }} />
      <Box sx={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <ReactFlowTreeCanvas
          people={rawPeople}
          rootPersonId={rootPersonId || rawPeople[0]?.id}
          forExport={true}
          onPersonClick={() => {}}
          onAddPerson={() => {}}
          onViewMemories={() => {}}
        />
      </Box>
    </>
  )
}
