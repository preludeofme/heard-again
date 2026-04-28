import { Box, Typography } from '@mui/material'
import { useRouter } from 'next/router'
import { LightbulbOutlined, ArrowForwardRounded } from '@mui/icons-material'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import type { Suggestion } from '@/controllers/useDashboardController'

interface SuggestionsProps {
  suggestions: Suggestion[]
}

export function Suggestions({ suggestions }: SuggestionsProps) {
  const router = useRouter()
  if (suggestions.length === 0) return null

  return (
    <Box
      component="section"
      sx={{
        bgcolor: ProfileColors.tertiaryFixed,
        borderRadius: '2rem',
        p: { xs: 4, md: 5 },
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        height: '100%',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <LightbulbOutlined sx={{ color: ProfileColors.onTertiaryFixedVariant, fontSize: 22 }} />
        <Typography
          sx={{
            fontFamily: 'var(--font-newsreader), serif',
            fontSize: { xs: '1.3rem', md: '1.5rem' },
            fontWeight: 700,
            color: ProfileColors.onTertiaryFixedVariant,
          }}
        >
          A few small ideas
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {suggestions.map(suggestion => (
          <Box
            key={suggestion.key}
            onClick={() => router.push(suggestion.href)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2.5,
              py: 1.75,
              borderRadius: '1rem',
              cursor: 'pointer',
              bgcolor: 'rgba(255,255,255,0.5)',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.85)',
                transform: 'translateX(4px)',
              },
            }}
          >
            <Typography
              sx={{
                flex: 1,
                fontFamily: 'var(--font-manrope), sans-serif',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: ProfileColors.onTertiaryFixedVariant,
              }}
            >
              {suggestion.label}
            </Typography>
            <ArrowForwardRounded sx={{ color: ProfileColors.onTertiaryFixedVariant, fontSize: 18 }} />
          </Box>
        ))}
      </Box>
    </Box>
  )
}
