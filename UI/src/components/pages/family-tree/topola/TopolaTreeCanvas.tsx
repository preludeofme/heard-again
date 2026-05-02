import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Box, Button, Typography, CircularProgress } from '@mui/material';
import { PersonAddOutlined as PersonAdd, Add } from '@mui/icons-material';
import { EmptyState } from '@/components/feedback/UIStates';
import { FamilyMemberCard } from '../FamilyMemberCard';
import { TreePerson } from '../types';
import * as d3 from 'd3';
import { SimpleRenderer, Chart } from 'topola';
import { HeardAgainDataAdapter, ApiPersonWithEdges } from './adapters/HeardAgainDataAdapter';
import { CustomNodeRenderer, NodeData } from './renderers/CustomNodeRenderer';

interface TopolaTreeCanvasProps {
  people: ApiPersonWithEdges[];
  rootPersonId?: string;
  isFullscreen: boolean;
  isMobile: boolean;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  toolMode: 'pointer' | 'hand';
  isDragging: boolean;
  onCanvasMouseDown: (e: React.MouseEvent) => void;
  onCanvasMouseMove: (e: React.MouseEvent) => void;
  onCanvasMouseUp: () => void;
  onCanvasTouchStart: (e: React.TouchEvent) => void;
  onCanvasTouchMove: (e: React.TouchEvent) => void;
  onCanvasTouchEnd: () => void;
  onPersonClick: (person: TreePerson) => void;
  onAddPerson: () => void;
  onViewArchive: (person: TreePerson) => void;
  onLoadMore?: (direction: 'up' | 'down') => void;
  onToggleSiblings?: () => void;
  includeSiblings?: boolean;
  loadedDepths?: { up: number; down: number };
  isLoadingMore?: boolean;
}

export function TopolaTreeCanvas({
  people,
  rootPersonId,
  isFullscreen,
  isMobile,
  zoomLevel,
  panOffset,
  toolMode,
  isDragging,
  onCanvasMouseDown,
  onCanvasMouseMove,
  onCanvasMouseUp,
  onCanvasTouchStart,
  onCanvasTouchMove,
  onCanvasTouchEnd,
  onPersonClick,
  onAddPerson,
  onViewArchive,
  onLoadMore,
  onToggleSiblings,
  includeSiblings = false,
  loadedDepths = { up: 2, down: 2 },
  isLoadingMore = false,
}: TopolaTreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const chartRef = useRef<Chart | null>(null);

  const hasData = people && people.length > 0;

  useEffect(() => {
    if (!hasData || !svgRef.current) return;

    // Clear previous SVG content except for our container group
    const svg = d3.select(svgRef.current);
    svg.selectAll('.topola-chart').remove();

    const chartGroup = svg.append('g').attr('class', 'topola-chart');

    const dataAdapter = new HeardAgainDataAdapter(people);
    
    // Choose start individual
    let startIndi = rootPersonId;
    if (!startIndi || !dataAdapter.getIndi(startIndi)) {
      startIndi = people[0]?.id;
    }

    if (!startIndi) return;

    const renderer = new CustomNodeRenderer({ horizontal: false }, (newNodes) => {
      setNodes(newNodes);
    });

    try {
      const chart = new Chart({
        data: dataAdapter,
        renderer,
        svgSelector: svgRef.current,
        startIndi,
        horizontal: false,
        animate: true,
      });

      // Override the group where Topola renders to ensure it doesn't replace everything
      // Actually Topola's Chart class expects an SVG or G selector and appends to it.
      // But we pass svgSelector as the SVG element itself. We should pass the G element.
      // Topola Chart uses d3.select(svgSelector). We'll pass the actual SVG and let Topola do its thing.
      chartRef.current = chart;
      
      // Topola automatically appends a <g> to the selector, but it needs to clear old stuff.
      // To ensure clean renders, we removed .topola-chart, but Topola appends standard d3 nodes.
      // Let's just recreate the SVG content cleanly.
      svg.selectAll('*').remove();

      chart.render();
    } catch (err) {
      console.error('Failed to render Topola chart:', err);
    }
  }, [people, rootPersonId, hasData]);

  // Virtualization is simpler now because Topola sets absolute coords and we just render React items there.
  // The SVG will handle panning/zooming via its container transform (or we can let D3 zoom handle it if we wanted, 
  // but we are using the existing panOffset/zoomLevel props).

  return (
    <Box
      ref={containerRef}
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
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.2s ease',
            width: '100%',
            height: '100%',
            minHeight: 1000, // Topola canvas can be large
            position: 'absolute'
          }}
        >
          {/* Topola SVG container for links */}
          <svg
            ref={svgRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 10000,
              height: 10000,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />

          {/* React rendered cards positioned according to Topola's coordinates */}
          {nodes.filter(n => n.data.indi).map((node) => {
            const indiId = node.data.indi?.id;
            if (!indiId) return null;
            
            // Reconstruct TreePerson for the card
            const apiPerson = people.find(p => p.id === indiId);
            if (!apiPerson) return null;

            const treePerson: TreePerson = {
              id: apiPerson.id,
              name: apiPerson.displayName || `${apiPerson.firstName} ${apiPerson.lastName || ''}`.trim(),
              role: apiPerson.id === rootPersonId ? 'Self' : 'Family Member',
              avatar: apiPerson.avatarUrl || '',
              memories: apiPerson.counts?.stories || 0,
              sex: apiPerson.sex,
              generation: 0,
              selected: apiPerson.id === rootPersonId
            };

            return (
              <Box
                key={node.id}
                sx={{
                  position: 'absolute',
                  left: node.x - node.width / 2,
                  top: node.y,
                  width: node.width,
                  zIndex: 2,
                }}
              >
                <FamilyMemberCard
                  person={treePerson}
                  level={'parent'} // Or dynamic based on layout
                  isSelf={treePerson.selected}
                  cardWidth={node.width}
                  isMobile={isMobile}
                  onPersonClick={onPersonClick}
                  onAddPerson={onAddPerson}
                  onViewArchive={onViewArchive}
                  onToggleSiblings={onToggleSiblings}
                  includeSiblings={includeSiblings}
                />
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
