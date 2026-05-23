import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import {
  Popover,
  Box,
  Typography,
  Avatar,
  InputBase,
  CircularProgress,
  Divider,
  ButtonBase,
} from '@mui/material'
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material'
import { useSelectedFamilyMember, SelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'

interface PersonOption {
  id: string
  firstName: string
  middleName?: string | null
  lastName?: string | null
  displayName?: string | null
  avatarUrl?: string | null
}

function memberLabel(p: PersonOption | SelectedFamilyMember): string {
  if (p.displayName) return p.displayName
  return [p.firstName, (p as any).middleName, p.lastName].filter(Boolean).join(' ') || 'Unnamed'
}

function getSearchableNameParts(member: PersonOption | SelectedFamilyMember): string[] {
  const p = member as PersonOption
  return [
    p.firstName,
    p.middleName,
    p.lastName,
    p.displayName,
  ].filter((value): value is string => Boolean(value))
}

function memberMatchesSearch(member: PersonOption | SelectedFamilyMember, query: string): boolean {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true

  const searchableText = getSearchableNameParts(member)
    .join(' ')
    .toLocaleLowerCase()

  return tokens.every(token => searchableText.includes(token))
}

interface MemberRowProps {
  member: PersonOption | SelectedFamilyMember
  isSelected: boolean
  onSelect: (m: PersonOption | SelectedFamilyMember) => void
}

function MemberRow({ member, isSelected, onSelect }: MemberRowProps) {
  return (
    <ButtonBase
      onClick={() => onSelect(member)}
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.25,
        borderRadius: 2,
        textAlign: 'left',
        backgroundColor: isSelected ? 'rgba(22, 51, 74, 0.08)' : 'transparent',
        '&:hover': { backgroundColor: 'rgba(22, 51, 74, 0.05)' },
        transition: 'background-color 0.15s',
      }}
    >
      <Avatar
        src={(member as PersonOption).avatarUrl || undefined}
        sx={{
          width: 32,
          height: 32,
          fontSize: 13,
          bgcolor: isSelected ? '#16334a' : '#d0e3e6',
          color: isSelected ? '#fff' : '#16334a',
          border: isSelected ? '2px solid #16334a' : '2px solid transparent',
          flexShrink: 0,
        }}
      >
        {(member as PersonOption).firstName?.[0]}
      </Avatar>
      <Typography
        variant="body2"
        sx={{
          fontWeight: isSelected ? 600 : 400,
          color: isSelected ? '#16334a' : 'text.primary',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {memberLabel(member)}
      </Typography>
      {isSelected && (
        <Box
          sx={{
            ml: 'auto',
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: '#16334a',
            flexShrink: 0,
          }}
        />
      )}
    </ButtonBase>
  )
}

interface MemberSwitcherFlyoutProps {
  anchorEl: HTMLElement | null
  onClose: () => void
  /** When provided, called instead of the default context-set + navigate behavior */
  onMemberSelect?: (member: PersonOption) => void
}

export function MemberSwitcherFlyout({ anchorEl, onClose, onMemberSelect }: MemberSwitcherFlyoutProps) {
  const router = useRouter()
  const { selectedFamilyMember, recentlyViewedMembers, setSelectedFamilyMember, clearSelectedFamilyMember } =
    useSelectedFamilyMember()

  const [searchQuery, setSearchQuery] = useState('')
  const [allMembers, setAllMembers] = useState<PersonOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const hasFetchedRef = useRef(false)
  const open = Boolean(anchorEl)

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      return
    }

    // Focus search on open
    const timer = setTimeout(() => searchRef.current?.focus(), 50)

    // Fetch all members once per mount; retry if previous fetch failed (hasFetchedRef stays false on failure)
    // limit=500 ensures the full family is loaded rather than the API default of 20
    if (!hasFetchedRef.current) {
      setIsLoading(true)
      fetch('/api/people?limit=500', { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data)) {
            setAllMembers(data.data)
            hasFetchedRef.current = true
          }
        })
        .catch(() => {})
        .finally(() => setIsLoading(false))
    }

    return () => clearTimeout(timer)
  }, [open])

  const handleSelect = useCallback(
    (member: PersonOption | SelectedFamilyMember) => {
      if (onMemberSelect) {
        onMemberSelect(member as PersonOption)
        onClose()
        return
      }

      setSelectedFamilyMember({
        id: member.id,
        firstName: (member as PersonOption).firstName,
        lastName: (member as PersonOption).lastName,
        displayName: (member as PersonOption).displayName,
        avatarUrl: (member as PersonOption).avatarUrl,
      })

      onClose()

      // Auto-navigate to profile, unless on family-tree
      if (router.pathname !== '/family-tree') {
        router.push(`/profile/${member.id}`)
      }
    },
    [setSelectedFamilyMember, onClose, router, onMemberSelect],
  )

  const handleClear = useCallback(() => {
    clearSelectedFamilyMember()
    onClose()
  }, [clearSelectedFamilyMember, onClose])

  const filteredMembers = allMembers.filter((m) => memberMatchesSearch(m, searchQuery))

  // Recent members scoped to the current familyspace — exclude selected and any cross-space leftovers
  const allMemberIds = new Set(allMembers.map((m) => m.id))
  const recentToShow = recentlyViewedMembers.filter(
    (r) => r.id !== selectedFamilyMember?.id && (!isLoading && allMembers.length > 0 ? allMemberIds.has(r.id) : true),
  )

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      PaperProps={{
        sx: {
          width: 320,
          maxHeight: 480,
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(22, 51, 74, 0.16)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      {/* Search header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: '#fafafa',
        }}
      >
        <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <InputBase
          inputRef={searchRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search family members…"
          fullWidth
          sx={{ fontSize: '0.875rem' }}
        />
        {searchQuery && (
          <CloseIcon
            sx={{ fontSize: 16, color: 'text.secondary', cursor: 'pointer' }}
            onClick={() => setSearchQuery('')}
          />
        )}
      </Box>

      <Box sx={{ overflowY: 'auto', flexGrow: 1, py: 1 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : searchQuery ? (
          /* Search results */
          <>
            <Typography
              variant="caption"
              sx={{ px: 2, py: 0.5, display: 'block', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}
            >
              Results
            </Typography>
            {filteredMembers.length === 0 ? (
              <Typography variant="body2" sx={{ px: 2, py: 2, color: 'text.secondary', fontStyle: 'italic' }}>
                No members match "{searchQuery}"
              </Typography>
            ) : (
              filteredMembers.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  isSelected={m.id === selectedFamilyMember?.id}
                  onSelect={handleSelect}
                />
              ))
            )}
          </>
        ) : (
          /* Default view: currently selected + recent + all */
          <>
            {selectedFamilyMember ? (
              <>
                <Typography
                  variant="caption"
                  sx={{ px: 2, py: 0.5, display: 'block', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                >
                  Currently viewing
                </Typography>
                <MemberRow
                  member={selectedFamilyMember}
                  isSelected
                  onSelect={handleSelect}
                />
                <ButtonBase
                  onClick={handleClear}
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 1.25,
                    borderRadius: 2,
                    textAlign: 'left',
                    color: 'text.secondary',
                    '&:hover': { backgroundColor: 'rgba(22, 51, 74, 0.05)', color: '#16334a' },
                    transition: 'all 0.15s',
                  }}
                >
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      fontSize: 13,
                      bgcolor: '#d0e3e6',
                      color: '#16334a',
                      flexShrink: 0,
                    }}
                  >
                    <SearchIcon sx={{ fontSize: 16 }} />
                  </Avatar>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    View Everyone's Story
                  </Typography>
                </ButtonBase>
                {recentToShow.length > 0 && <Divider sx={{ my: 1 }} />}
              </>
            ) : (
              <Box sx={{ px: 1, pb: 1 }}>
                <ButtonBase
                  disabled
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 1.25,
                    borderRadius: 2,
                    textAlign: 'left',
                    backgroundColor: 'rgba(22, 51, 74, 0.08)',
                  }}
                >
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      fontSize: 13,
                      bgcolor: '#16334a',
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    <SearchIcon sx={{ fontSize: 16 }} />
                  </Avatar>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#16334a' }}>
                    Everyone's Story
                  </Typography>
                </ButtonBase>
                <Divider sx={{ mt: 1 }} />
              </Box>
            )}

            {recentToShow.length > 0 && (
              <>
                <Typography
                  variant="caption"
                  sx={{ px: 2, py: 0.5, display: 'block', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                >
                  Recently viewed
                </Typography>
                {recentToShow.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    isSelected={false}
                    onSelect={handleSelect}
                  />
                ))}
                <Divider sx={{ my: 1 }} />
              </>
            )}

            <Typography
              variant="caption"
              sx={{ px: 2, py: 0.5, display: 'block', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}
            >
              All members
            </Typography>
            {allMembers.length === 0 ? (
              <Typography variant="body2" sx={{ px: 2, py: 2, color: 'text.secondary', fontStyle: 'italic' }}>
                No family members added yet.
              </Typography>
            ) : (
              allMembers.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  isSelected={m.id === selectedFamilyMember?.id}
                  onSelect={handleSelect}
                />
              ))
            )}
          </>
        )}
      </Box>
    </Popover>
  )
}
