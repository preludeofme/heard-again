import React from 'react'
import {
  Box,
  CircularProgress,
  Divider,
  IconButton,
  Button,
  Tooltip,
} from '@mui/material'
import {
  ZoomIn,
  ZoomOut,
  RestartAlt,
  NearMe,
  PanTool,
  Search as SearchIcon,
  PersonAddOutlined as PersonAdd,
  Fullscreen,
  FullscreenExit,
  UploadFile,
  FileDownload,
  PeopleAltOutlined as PeopleIcon,
  AccountTree,
  Image as ImageIcon,
  PictureAsPdf,
  Polyline as SvgIcon,
} from '@mui/icons-material'

interface FamilyTreeControlsProps {
  isFullscreen: boolean
  isMobile: boolean
  toolMode: 'pointer' | 'hand'
  setToolMode: (mode: 'pointer' | 'hand') => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onOpenSearch: () => void
  onOpenRelationshipEditor: () => void
  onToggleFullscreen?: () => void
  onImportGedcom?: () => void
  onExportGedcom?: () => void
  onToggleSiblings?: () => void
  includeSiblings?: boolean
  onLoadAll?: () => void
  onExportPng?: () => void
  onExportSvg?: () => void
  onExportPdf?: () => void
  isExportingPng?: boolean
}

export function FamilyTreeControls({
  isFullscreen,
  isMobile,
  toolMode,
  setToolMode,
  onZoomIn,
  onZoomOut,
  onResetView,
  onOpenSearch,
  onOpenRelationshipEditor,
  onToggleFullscreen,
  onImportGedcom,
  onExportGedcom,
  onToggleSiblings,
  includeSiblings = false,
  onLoadAll,
  onExportPng,
  onExportSvg,
  onExportPdf,
  isExportingPng = false,
}: FamilyTreeControlsProps) {
  return (
    <Box
      sx={{
        position: 'sticky',
        top: isFullscreen ? 8 : { xs: 72, md: 84 },
        zIndex: 25,
        pt: 0.5,
        pb: 1.5,
        mb: 1,
        background: 'linear-gradient(to bottom, rgba(246,243,238,0.95), rgba(246,243,238,0.65), rgba(246,243,238,0))',
        backdropFilter: 'blur(6px)',
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto', display: 'flex', justifyContent: 'center' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            bgcolor: 'background.paper',
            px: 1,
            py: 0.5,
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid',
            borderColor: 'rgba(208, 227, 230, 0.5)',
            flexWrap: 'nowrap',
            overflowX: 'auto',
          }}
        >
          <IconButton
            size="small"
            onClick={onOpenSearch}
            sx={{ color: 'primary.main' }}
            title="Search family members"
          >
            <SearchIcon sx={{ fontSize: 18 }} />
          </IconButton>

          {onToggleSiblings && (
            <IconButton
              size="small"
              onClick={onToggleSiblings}
              sx={{
                color: includeSiblings ? 'white' : 'primary.main',
                bgcolor: includeSiblings ? 'primary.main' : 'transparent',
                '&:hover': { bgcolor: includeSiblings ? 'primary.dark' : 'rgba(22, 51, 74, 0.08)' },
              }}
              title={includeSiblings ? "Hide Siblings" : "Show Siblings"}
            >
              <PeopleIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }} />

          {!isMobile && (
            <>
              <IconButton
                size="small"
                onClick={() => setToolMode('pointer')}
                sx={{
                  color: toolMode === 'pointer' ? 'white' : 'primary.main',
                  bgcolor: toolMode === 'pointer' ? 'primary.main' : 'transparent',
                  '&:hover': { bgcolor: toolMode === 'pointer' ? 'primary.dark' : 'rgba(22, 51, 74, 0.08)' },
                }}
                title="Pointer tool"
              >
                <NearMe sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setToolMode('hand')}
                sx={{
                  color: toolMode === 'hand' ? 'white' : 'primary.main',
                  bgcolor: toolMode === 'hand' ? 'primary.main' : 'transparent',
                  '&:hover': { bgcolor: toolMode === 'hand' ? 'primary.dark' : 'rgba(22, 51, 74, 0.08)' },
                }}
                title="Hand tool (drag to pan)"
              >
                <PanTool sx={{ fontSize: 18 }} />
              </IconButton>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }} />
            </>
          )}

          <IconButton size="small" sx={{ color: 'primary.main' }} onClick={onZoomIn} title="Zoom in">
            <ZoomIn />
          </IconButton>
          <IconButton size="small" sx={{ color: 'primary.main' }} onClick={onZoomOut} title="Zoom out">
            <ZoomOut />
          </IconButton>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }} />

          <IconButton
            size="small"
            onClick={onOpenRelationshipEditor}
            sx={{ color: 'primary.main' }}
            title="Edit relationships"
          >
            <PersonAdd sx={{ fontSize: 18 }} />
          </IconButton>
          {!isMobile && (
            <Button
              size="small"
              onClick={onOpenRelationshipEditor}
              sx={{ color: 'primary.main', textTransform: 'none', display: { xs: 'none', md: 'flex' } }}
            >
              Relationships
            </Button>
          )}

          <IconButton
            size="small"
            onClick={onResetView}
            sx={{ color: 'primary.main' }}
            title="Reset view"
          >
            <RestartAlt sx={{ fontSize: 18 }} />
          </IconButton>

          {onImportGedcom && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }} />
              <IconButton
                size="small"
                onClick={onImportGedcom}
                sx={{ color: 'primary.main' }}
                title="Import GEDCOM"
              >
                <UploadFile sx={{ fontSize: 18 }} />
              </IconButton>
            </>
          )}

          {onExportGedcom && (
            <>
              {!onImportGedcom && <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }} />}
              <IconButton
                size="small"
                onClick={onExportGedcom}
                sx={{ color: 'primary.main' }}
                title="Export GEDCOM"
              >
                <FileDownload sx={{ fontSize: 18 }} />
              </IconButton>
            </>
          )}

          {onLoadAll && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }} />
              <IconButton
                size="small"
                onClick={onLoadAll}
                sx={{ color: 'primary.main' }}
                title="Load entire family tree"
              >
                <AccountTree sx={{ fontSize: 18 }} />
              </IconButton>
              {!isMobile && (
                <Button
                  size="small"
                  onClick={onLoadAll}
                  sx={{ color: 'primary.main', textTransform: 'none', display: { xs: 'none', md: 'flex' } }}
                >
                  Load All
                </Button>
              )}
            </>
          )}

          {onToggleFullscreen && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }} />
              <IconButton
                size="small"
                onClick={onToggleFullscreen}
                sx={{ color: 'primary.main' }}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
              </IconButton>
            </>
          )}

          {(onExportPng || onExportSvg || onExportPdf) && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(208, 227, 230, 0.6)' }} />
              {onExportPng && (
                <Tooltip title={isExportingPng ? 'Generating export…' : 'Download PNG'} arrow>
                  <span>
                    <IconButton
                      size="small"
                      onClick={onExportPng}
                      disabled={isExportingPng}
                      sx={{ color: 'primary.main', position: 'relative' }}
                    >
                      {isExportingPng
                        ? <CircularProgress size={18} sx={{ color: 'primary.main' }} />
                        : <ImageIcon sx={{ fontSize: 18 }} />
                      }
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              {onExportSvg && (
                <Tooltip title={isExportingPng ? 'Generating export…' : 'Download SVG (print quality)'} arrow>
                  <span>
                    <IconButton
                      size="small"
                      onClick={onExportSvg}
                      disabled={isExportingPng}
                      sx={{ color: 'primary.main' }}
                    >
                      {isExportingPng
                        ? <CircularProgress size={18} sx={{ color: 'primary.main' }} />
                        : <SvgIcon sx={{ fontSize: 18 }} />
                      }
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              {onExportPdf && (
                <Tooltip title="Export as PDF (print dialog). For large trees, export may be slow." arrow>
                  <IconButton
                    size="small"
                    onClick={onExportPdf}
                    sx={{ color: 'primary.main' }}
                  >
                    <PictureAsPdf sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  )
}
