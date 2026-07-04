import React, { useState, useEffect, useRef } from 'react'
import {
  Autocomplete,
  TextField,
  CircularProgress,
  Typography,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'

export interface LocationValue {
  displayText: string
  city: string
  state: string
  lat?: number
  lng?: number
}

interface LocationSuggestion {
  placeId: string
  displayText: string
  city: string
  state: string
}

interface LocationAutocompleteProps {
  value: LocationValue | null
  onChange: (loc: LocationValue | null) => void
  label?: string
  size?: 'small' | 'medium'
  sx?: SxProps<Theme>
  inputSx?: SxProps<Theme>
}

export function LocationAutocomplete({
  value,
  onChange,
  label = 'Location',
  size = 'medium',
  sx,
  inputSx,
}: LocationAutocompleteProps): React.ReactElement {
  const [inputValue, setInputValue] = useState(value?.displayText ?? '')
  const [options, setOptions] = useState<LocationSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [notConfigured, setNotConfigured] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setInputValue(value?.displayText ?? '')
  }, [value])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (inputValue.length < 2) {
      setOptions([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort()
      abortRef.current = new AbortController()

      setLoading(true)
      try {
        const res = await fetch(
          `/api/locations/autocomplete?input=${encodeURIComponent(inputValue)}`,
          { signal: abortRef.current.signal }
        )
        if (!res.ok) return
        const data = (await res.json()) as { success: boolean; data: { suggestions: LocationSuggestion[] } }
        const suggestions = data?.data?.suggestions ?? []
        setNotConfigured(inputValue.length >= 2 && suggestions.length === 0)
        setOptions(suggestions)
      } catch {
        // aborted or network error — ignore
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [inputValue])

  const handleChange = async (
    _: React.SyntheticEvent,
    selected: LocationSuggestion | null
  ): Promise<void> => {
    if (!selected) {
      onChange(null)
      return
    }

    const base: LocationValue = {
      displayText: selected.displayText,
      city: selected.city,
      state: selected.state,
    }

    // Fetch lat/lng in the background — don't block the UI
    onChange(base)

    try {
      const res = await fetch(`/api/locations/details?placeId=${encodeURIComponent(selected.placeId)}`)
      if (!res.ok) return
      const data = (await res.json()) as {
        success: boolean
        data: { city: string; state: string; lat: number; lng: number }
      }
      if (data?.success && data.data) {
        onChange({
          displayText: selected.displayText,
          city: data.data.city || selected.city,
          state: data.data.state || selected.state,
          lat: data.data.lat,
          lng: data.data.lng,
        })
      }
    } catch {
      // Details fetch failed — base value without coords is fine
    }
  }

  return (
    <Autocomplete<LocationSuggestion, false, false, false>
      options={options}
      getOptionLabel={(opt) => opt.displayText}
      isOptionEqualToValue={(opt, val) => opt.placeId === val.placeId}
      filterOptions={(x) => x}
      loading={loading}
      inputValue={inputValue}
      onInputChange={(_, val) => setInputValue(val)}
      onChange={handleChange}
      noOptionsText={
        inputValue.length < 2
          ? 'Type a place name…'
          : notConfigured
          ? 'Location search needs setup — check your account settings for a Google Maps API key'
          : 'No results found'
      }
      sx={sx}
      renderOption={(props, option) => (
        <li {...props} key={option.placeId}>
          <LocationOnOutlinedIcon sx={{ mr: 1, color: 'text.secondary', fontSize: '1.1rem' }} />
          <Typography variant="body2">{option.displayText}</Typography>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          size={size}
          placeholder="e.g. Chicago, IL or Vandenberg AFB"
          sx={inputSx}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading && <CircularProgress color="inherit" size={16} />}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  )
}
