import { Box, Typography } from '@mui/material'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import { WaveformPlayer } from './WaveformPlayer'

interface VoicePlayerProps {
  personName: string
  storyTitle: string
  audioUrl: string
}

export function VoicePlayer({ personName, storyTitle, audioUrl }: VoicePlayerProps) {
  return (
    <Box
      sx={{
        p: 3,
        backgroundColor: ProfileColors.surfaceContainerLow,
        borderRadius: 4,
        border: `1px solid ${ProfileColors.outlineVariant}20`,
      }}
    >
      <Typography
        sx={{
          fontFamily: 'var(--font-manrope), sans-serif',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: ProfileColors.onSurfaceVariant,
          mb: 0.5,
        }}
      >
        {personName}&apos;s Voice
      </Typography>
      <Typography
        sx={{
          fontFamily: 'var(--font-newsreader), serif',
          fontSize: '1.1rem',
          fontWeight: 700,
          color: ProfileColors.primary,
          mb: 2,
        }}
      >
        {storyTitle}
      </Typography>

      <WaveformPlayer audioUrl={audioUrl} />
    </Box>
  )
}
