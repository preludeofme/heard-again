import React, { useMemo, useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Card,
  Avatar,
  IconButton,
  Chip,
} from '@mui/material'
import {
  Search,
  ExpandMore,
  ExpandLess,
  Close,
} from '@mui/icons-material'

export interface SearchableFamilyMember {
  id: string
  name: string
  relationship?: string
  avatar?: string
  subtitle?: string
}

export interface FamilyMemberSearchProps {
  /** Array of family members to search through */
  members: SearchableFamilyMember[]
  /** Currently selected member ID (controlled) */
  selectedId?: string | null
  /** Callback when a member is selected */
  onSelect: (member: SearchableFamilyMember | null) => void
  /** Placeholder text for the search input */
  placeholder?: string
  /** Title displayed in the search panel header */
  title?: string
  /** Whether the search panel is initially expanded */
  defaultExpanded?: boolean
  /** Control expanded state externally */
  expanded?: boolean
  /** Callback when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void
  /** Maximum number of results to show */
  maxResults?: number
  /** Custom renderer for member items */
  renderMember?: (member: SearchableFamilyMember, isSelected: boolean) => React.ReactNode
  /** Custom filter function */
  filterFn?: (member: SearchableFamilyMember, query: string) => boolean
  /** Debounce delay in milliseconds */
  debounceMs?: number
  /** Whether to show the expand/collapse button */
  showExpandButton?: boolean
  /** Whether to show the selected member as a chip */
  showSelectedChip?: boolean
  /** Custom styles for the container */
  sx?: React.CSSProperties
  /** Whether the search is loading */
  loading?: boolean
  /** Show "Clear" button to reset selection */
  allowClear?: boolean
  /** Additional content to render below search results */
  children?: React.ReactNode
}

/**
 * Reusable family member search component with debounced type-ahead
 * and collapsible panel. Supports both controlled and uncontrolled modes.
 */
export function FamilyMemberSearch({
  members,
  selectedId,
  onSelect,
  placeholder = 'Search by name or relationship',
  title = 'Family Member Search',
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  maxResults = 8,
  renderMember,
  filterFn,
  debounceMs = 250,
  showExpandButton = true,
  showSelectedChip = true,
  sx,
  loading = false,
  allowClear = true,
  children,
}: FamilyMemberSearchProps) {
  const isControlled = controlledExpanded !== undefined
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
  const isExpanded = isControlled ? controlledExpanded : internalExpanded

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce search query
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, debounceMs)
    return () => clearTimeout(timeout)
  }, [searchQuery, debounceMs])

  const handleExpandedChange = (newExpanded: boolean) => {
    if (!isControlled) {
      setInternalExpanded(newExpanded)
    }
    onExpandedChange?.(newExpanded)
  }

  const defaultFilter = (member: SearchableFamilyMember, query: string): boolean => {
    const lowerQuery = query.toLowerCase()
    return (
      member.name.toLowerCase().includes(lowerQuery) ||
      (member.relationship?.toLowerCase().includes(lowerQuery) ?? false) ||
      (member.subtitle?.toLowerCase().includes(lowerQuery) ?? false)
    )
  }

  const filter = filterFn || defaultFilter

  const filteredResults = useMemo(() => {
    const query = debouncedQuery.trim()
    if (!query) return []

    return members
      .filter((member) => filter(member, query))
      .slice(0, maxResults)
  }, [debouncedQuery, members, filter, maxResults])

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedId) || null,
    [members, selectedId]
  )

  const handleSelect = (member: SearchableFamilyMember) => {
    onSelect(member)
    setSearchQuery('')
    setDebouncedQuery('')
  }

  const handleClear = () => {
    onSelect(null)
    setSearchQuery('')
    setDebouncedQuery('')
  }

  const defaultRenderMember = (member: SearchableFamilyMember, isSelected: boolean) => (
    <Button
      key={member.id}
      variant="text"
      onClick={() => handleSelect(member)}
      sx={{
        justifyContent: 'flex-start',
        textTransform: 'none',
        borderRadius: 2,
        p: 1,
        color: 'inherit',
        bgcolor: isSelected ? 'rgba(22, 51, 74, 0.08)' : 'transparent',
        '&:hover': { bgcolor: 'rgba(22, 51, 74, 0.06)' },
        width: '100%',
      }}
    >
      <Avatar
        src={member.avatar}
        sx={{ width: 36, height: 36, mr: 1.5, flexShrink: 0 }}
      />
      <Box sx={{ textAlign: 'left', overflow: 'hidden' }}>
        <Typography
          variant="body2"
          sx={{
            color: 'primary.main',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {member.name}
        </Typography>
        {(member.relationship || member.subtitle) && (
          <Typography
            variant="caption"
            sx={{
              color: 'secondary.main',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
            }}
          >
            {member.relationship || member.subtitle}
          </Typography>
        )}
      </Box>
    </Button>
  )

  return (
    <Card
      sx={{
        p: 2,
        borderRadius: 4,
        bgcolor: 'rgba(255, 255, 255, 0.82)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 10px 40px rgba(28, 28, 25, 0.06)',
        ...sx,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Search sx={{ color: 'primary.main' }} />
          <Typography sx={{ color: 'primary.main', fontWeight: 600 }}>
            {title}
          </Typography>
        </Box>
        {showExpandButton && (
          <Button
            size="small"
            variant="text"
            onClick={() => handleExpandedChange(!isExpanded)}
            endIcon={isExpanded ? <ExpandLess /> : <ExpandMore />}
            sx={{ textTransform: 'none', color: 'secondary.main' }}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </Button>
        )}
      </Box>

      {/* Expanded Content */}
      {isExpanded && (
        <Box sx={{ mt: 2.5 }}>
          {/* Search Input */}
          <Box
            component="input"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder={placeholder}
            disabled={loading}
            sx={{
              width: '100%',
              border: 0,
              outline: 0,
              bgcolor: loading ? 'rgba(235, 232, 227, 0.5)' : '#ebe8e3',
              borderRadius: 2,
              px: 2,
              py: 1.5,
              fontSize: '0.95rem',
              color: '#1c1c19',
              transition: 'all 0.2s ease',
              cursor: loading ? 'not-allowed' : 'text',
              '&:focus': {
                bgcolor: '#ffffff',
                boxShadow: '0 0 0 1px rgba(22, 51, 74, 0.2)',
              },
            }}
          />

          {/* Selected Member Chip */}
          {showSelectedChip && selectedMember && (
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                avatar={<Avatar src={selectedMember.avatar} />}
                label={selectedMember.name}
                onDelete={allowClear ? handleClear : undefined}
                deleteIcon={allowClear ? <Close /> : undefined}
                sx={{
                  bgcolor: 'rgba(22, 51, 74, 0.08)',
                  '& .MuiChip-label': { color: 'primary.main', fontWeight: 500 },
                }}
              />
            </Box>
          )}

          {/* Search Results */}
          {debouncedQuery.trim() && (
            <Box sx={{ mt: 2, maxHeight: 280, overflowY: 'auto', pr: 0.5 }}>
              {loading ? (
                <Typography variant="body2" sx={{ color: 'secondary.main', py: 2, textAlign: 'center' }}>
                  Loading...
                </Typography>
              ) : filteredResults.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'secondary.main', py: 2 }}>
                  No matching family members found.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {filteredResults.map((member) =>
                    renderMember
                      ? renderMember(member, member.id === selectedId)
                      : defaultRenderMember(member, member.id === selectedId)
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* Additional Content */}
          {children}
        </Box>
      )}
    </Card>
  )
}

export default FamilyMemberSearch
