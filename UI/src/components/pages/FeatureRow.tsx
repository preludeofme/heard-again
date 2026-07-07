import React from 'react'
import { Box, Typography } from '@mui/material'
import { Check, Close } from '@mui/icons-material'

export interface FeatureRowProps {
  icon: React.ReactNode
  label: React.ReactNode
  included: boolean
  strikeThrough?: boolean
  warning?: boolean
}

export function FeatureRow({
  icon,
  label,
  included,
  strikeThrough = true,
  warning = false,
}: FeatureRowProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
      <Box
        sx={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: included ? '#d0e3e6' : warning ? '#fae8e8' : '#f6f3ee',
          color: included ? '#16334a' : warning ? '#c0392b' : '#999',
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {included ? <Check sx={{ fontSize: 12 }} /> : <Close sx={{ fontSize: 12 }} />}
      </Box>
      <Typography
        variant="body2"
        sx={{
          color: included ? '#546669' : warning ? '#7f8c8d' : '#999',
          textDecoration: !included && strikeThrough ? 'line-through' : 'none',
          fontSize: '0.9rem',
          lineHeight: 1.3,
        }}
      >
        {label}
      </Typography>
    </Box>
  )
}
