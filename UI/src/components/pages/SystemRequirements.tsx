import React from 'react'
import { Box, Typography, Grid } from '@mui/material'
import { Check } from '@mui/icons-material'
import { FeatureRow } from './FeatureRow'
import { systemRequirementTiers, type SystemRequirementTier } from '@/lib/systemRequirements'

export interface SystemRequirementsProps {
  title?: string
  tiers?: SystemRequirementTier[]
}

export function SystemRequirements({
  title = 'Minimum System Requirements',
  tiers = systemRequirementTiers,
}: SystemRequirementsProps) {
  return (
    <Box>
      {title && (
        <Typography
          variant="subtitle2"
          sx={{
            color: '#16334a',
            fontWeight: 700,
            mb: 2,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontSize: '0.75rem',
          }}
        >
          {title}
        </Typography>
      )}
      <Grid container spacing={3}>
        {tiers.map((tier) => (
          <Grid size={{ xs: 12, sm: 6 }} key={tier.title}>
            <Typography variant="body2" sx={{ color: '#16334a', fontWeight: 600, mb: 0.5 }}>
              {tier.title}
            </Typography>
            {tier.items.map((item, idx) => (
              <FeatureRow key={idx} icon={<Check />} label={item} included strikeThrough={false} />
            ))}
            {tier.note && (
              <Typography variant="caption" sx={{ color: '#7f8c8d', display: 'block', mt: 1, lineHeight: 1.5 }}>
                {tier.note}
              </Typography>
            )}
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
