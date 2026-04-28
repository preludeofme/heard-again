import React from 'react'
import {
  Box,
  Typography,
  IconButton,
  InputBase,
  Fade,
} from '@mui/material'
import {
  Close as CloseIcon,
  Search as SearchIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material'
import { FamilyMemberSearch, SearchableFamilyMember } from '@/components/search'

interface FamilyTreeSearchOverlayProps {
  open: boolean
  onClose: () => void
  query: string
  setQuery: (query: string) => void
  searchableMembers: SearchableFamilyMember[]
  onMemberSelect: (id: string) => void
  inputRef: React.RefObject<HTMLInputElement>
}

export function FamilyTreeSearchOverlay({
  open,
  onClose,
  query,
  setQuery,
  searchableMembers,
  onMemberSelect,
  inputRef,
}: FamilyTreeSearchOverlayProps) {
  if (!open) return null

  return (
    <Fade in={open}>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'rgba(255, 255, 255, 0.98)',
          zIndex: 1400,
          p: { xs: 2, md: 4 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 800 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
            <IconButton onClick={onClose} sx={{ mr: 2 }}>
              <ArrowBackIcon />
            </IconButton>
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'rgba(22, 51, 74, 0.05)',
                px: 3,
                py: 1.5,
                borderRadius: 4,
                border: '1px solid rgba(22, 51, 74, 0.1)',
              }}
            >
              <SearchIcon sx={{ color: 'text.secondary', mr: 2 }} />
              <InputBase
                fullWidth
                placeholder="Search your family lineage..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                inputRef={inputRef}
                sx={{ fontSize: '1.25rem', fontFamily: 'var(--font-newsreader), serif' }}
              />
              {query && (
                <IconButton size="small" onClick={() => setQuery('')}>
                  <CloseIcon />
                </IconButton>
              )}
            </Box>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700, ml: 1 }}>
              Search Results
            </Typography>
            <FamilyMemberSearch
              members={searchableMembers}
              onSelect={(id) => {
                onMemberSelect(id)
                onClose()
              }}
              query={query}
              autoFocus={false}
              showAllOnEmpty={true}
            />
          </Box>
        </Box>
      </Box>
    </Fade>
  )
}
