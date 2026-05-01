import React from 'react'
import {
  Box,
  Typography,
  Card,
  IconButton,
  Divider,
} from '@mui/material'
import {
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material'

interface FamilyTreeSidebarProps {
  legendCollapsed: boolean
  setLegendCollapsed: (collapsed: boolean) => void
}

export function FamilyTreeSidebar({
  legendCollapsed,
  setLegendCollapsed,
}: FamilyTreeSidebarProps) {
  return (
    <Box
      sx={{
        position: 'absolute',
        right: 48,
        top: 80,
        display: { xs: 'none', xl: 'flex' },
        flexDirection: 'column',
        gap: 2,
        zIndex: 10,
      }}
    >
      {/* Visual Legend */}
      <Card
        sx={{
          width: 240,
          p: 2,
          borderRadius: 4,
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          border: '1px solid',
          borderColor: 'rgba(208, 227, 230, 0.5)',
          bgcolor: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: legendCollapsed ? 0 : 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Tree Legend
          </Typography>
          <IconButton size="small" onClick={() => setLegendCollapsed(!legendCollapsed)}>
            {legendCollapsed ? <ExpandMore /> : <ExpandLess />}
          </IconButton>
        </Box>
        
        {!legendCollapsed && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 24, height: 3, bgcolor: 'rgba(22, 51, 74, 0.52)', borderRadius: 1 }} />
              <Typography variant="caption" sx={{ fontWeight: 500 }}>Biological</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 24, height: 3, border: '1.5px dashed rgba(22, 51, 74, 0.35)', borderRadius: 1 }} />
              <Typography variant="caption" sx={{ fontWeight: 500 }}>Non-Biological</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 24, height: 3, bgcolor: 'rgba(22, 51, 74, 0.34)', borderRadius: 1 }} />
              <Typography variant="caption" sx={{ fontWeight: 500 }}>Spousal</Typography>
            </Box>
            <Divider sx={{ my: 0.5, borderColor: 'rgba(208, 227, 230, 0.4)' }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#1a6b5a' }} />
              <Typography variant="caption" sx={{ fontWeight: 500 }}>Active Member</Typography>
            </Box>
          </Box>
        )}
      </Card>

    </Box>
  )
}
