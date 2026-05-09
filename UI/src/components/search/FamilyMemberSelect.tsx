import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Autocomplete,
  TextField,
  Avatar,
  Box,
  Typography,
  CircularProgress,
  type SxProps,
  type Theme,
} from '@mui/material'
import { Search as SearchIcon } from '@mui/icons-material'

export interface FamilyMemberOption {
  id: string
  name: string
  avatar?: string
  relationship?: string
  subtitle?: string
}

interface FamilyMemberSelectProps {
  /** Currently selected member ID */
  value: string | null
  /** Callback when selection changes */
  onChange: (id: string | null) => void
  /** Label for the input */
  label?: string
  /** Placeholder text */
  placeholder?: string
  /** Whether the field should take up full width */
  fullWidth?: boolean
  /** Input size */
  size?: 'small' | 'medium'
  /** Error state */
  error?: boolean
  /** Helper text for error state */
  helperText?: string
  /** IDs to exclude from search results */
  excludeIds?: string[]
  /** Custom styles */
  sx?: SxProps<Theme>
  /** Disable the component */
  disabled?: boolean
  /** Required field */
  required?: boolean
}

/**
 * Unified family member selection component.
 * Uses Autocomplete with debounced remote search.
 */
export function FamilyMemberSelect({
  value,
  onChange,
  label = 'Select Family Member',
  placeholder = 'Search by name...',
  fullWidth = true,
  size = 'medium',
  error = false,
  helperText = '',
  excludeIds = [],
  sx,
  disabled = false,
  required = false,
}: FamilyMemberSelectProps) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<FamilyMemberOption[]>([])
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [debouncedInputValue, setDebouncedInputValue] = useState('')

  // Debounce input value for search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedInputValue(inputValue)
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  // Remote search
  useEffect(() => {
    let active = true

    // Fetch initial list or on search
    if (!open && debouncedInputValue === '') {
      return undefined
    }

    setLoading(true)
    const fetchOptions = async () => {
      try {
        const res = await fetch(`/api/people?search=${encodeURIComponent(debouncedInputValue)}&limit=15`, { credentials: 'include' })
        const data = await res.json()
        if (active && data.success && data.data) {
          const mapped = data.data.map((p: any) => ({
            id: p.id,
            name: p.displayName || `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`,
            avatar: p.avatarUrl || p.avatar || '',
            relationship: p.personType ? (p.personType.charAt(0) + p.personType.slice(1).toLowerCase()) : 'Family Member',
          }))
          setOptions(mapped)
        }
      } catch (err) {
        console.error('Failed to fetch family members:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchOptions()

    return () => {
      active = false
    }
  }, [debouncedInputValue, open])

  // Ensure selected value is in options list (e.g. on initial load)
  useEffect(() => {
    if (value && !options.find(o => o.id === value)) {
      fetch(`/api/people/${value}`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            const p = data.data
            const option = {
              id: p.id,
              name: p.displayName || `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`,
              avatar: p.avatarUrl || p.avatar || '',
              relationship: p.personType ? (p.personType.charAt(0) + p.personType.slice(1).toLowerCase()) : 'Family Member',
            }
            setOptions(prev => {
              // Avoid duplicates
              if (prev.find(o => o.id === option.id)) return prev
              return [...prev, option]
            })
          }
        })
        .catch(err => console.error('Failed to fetch selected person details:', err))
    }
  }, [value, options])

  const selectedOption = useMemo(() => 
    options.find(o => o.id === value) || null
  , [options, value])

  const filteredOptions = useMemo(() => 
    options.filter(o => !excludeIds.includes(o.id))
  , [options, excludeIds])

  return (
    <Autocomplete
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      value={selectedOption}
      onChange={(_, newValue) => {
        onChange(newValue ? newValue.id : null)
      }}
      inputValue={inputValue}
      onInputChange={(_, newInputValue) => {
        setInputValue(newInputValue)
      }}
      options={filteredOptions}
      loading={loading}
      disabled={disabled}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      fullWidth={fullWidth}
      size={size}
      sx={sx}
      filterOptions={(x) => x} // Disable local filtering, use remote only
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          error={error}
          required={required}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <>
                <SearchIcon sx={{ color: 'text.secondary', ml: 1, mr: -0.5, fontSize: 18 }} />
                {params.InputProps.startAdornment}
              </>
            ),
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={16} sx={{ mr: 1 }} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id} sx={{ ...props.sx, py: '8px !important' }}>
          <Avatar
            src={option.avatar}
            sx={{ width: 32, height: 32, mr: 1.5, flexShrink: 0, bgcolor: 'rgba(22, 51, 74, 0.08)', color: 'primary.main', fontSize: '0.875rem' }}
          >
            {option.name[0]}
          </Avatar>
          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {option.name}
            </Typography>
            {option.relationship && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {option.relationship}
              </Typography>
            )}
          </Box>
        </Box>
      )}
    />
  )
}

export default FamilyMemberSelect
