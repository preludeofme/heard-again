import { useState } from 'react'
import { Box, Typography, Collapse, Button } from '@mui/material'
import { ExpandMore, ExpandLess, AutoAwesome } from '@mui/icons-material'

interface ScriptLine {
  direction: string
  text: string
}

const SCRIPT_LINES: readonly ScriptLine[] = [
  {
    direction: 'Normal voice — relaxed and warm',
    text: 'Hi, my name is _______, and I am recording this so my voice can be heard again by my family.',
  },
  {
    direction: 'Soften — like sharing a quiet memory',
    text: 'I remember the small sounds: laughter at the table, the radio playing, and the screen door swinging shut.',
  },
  {
    direction: 'Speak up and brighten — with energy',
    text: 'But there were loud days too! Dogs barking and kids shouting "watch this" from the top of the hill!',
  },
  {
    direction: 'Settle down — gentle and natural',
    text: 'My favorite was always someone calling my name for supper as the day finally wound down.',
  },
] as const

const READING_TIPS: readonly string[] = [
  'Find a quiet room with no background noise',
  'Hold the mic a hand-width from your mouth',
  'Read in your natural voice, varying volume as directed',
  'Aim for about 25–30 seconds total',
  'If you stumble, just restart the recording for a clean take',
] as const

export function VoiceCloneScript() {
  const [showTips, setShowTips] = useState(false)

  return (
    <Box
      sx={{
        backgroundColor: '#fcf9f4',
        border: '1px solid #d0e3e6',
        borderRadius: 3,
        p: 2.5,
        mb: 3,
        textAlign: 'left',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <AutoAwesome sx={{ fontSize: 18, color: '#16334a' }} />
        <Typography
          variant="subtitle2"
          sx={{ color: '#16334a', fontWeight: 700, letterSpacing: 0.2 }}
        >
          Read this aloud for the best voice clone
        </Typography>
      </Box>

      <Typography variant="caption" sx={{ display: 'block', color: '#546669', mb: 2 }}>
        The model copies whatever range is in this recording. Shifting from soft to bright to
        gentle gives it more of your real voice to learn from.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        {SCRIPT_LINES.map((line, idx) => (
          <Box key={idx}>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: '#8a6a3a',
                fontStyle: 'italic',
                fontSize: '0.72rem',
                mb: 0.25,
              }}
            >
              {line.direction}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: '#16334a',
                lineHeight: 1.55,
                fontFamily: 'var(--font-newsreader), serif',
                fontSize: '0.95rem',
              }}
            >
              {line.text}
            </Typography>
          </Box>
        ))}
      </Box>

      <Button
        size="small"
        onClick={() => setShowTips((prev) => !prev)}
        endIcon={showTips ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        sx={{
          mt: 1.5,
          textTransform: 'none',
          color: '#546669',
          fontSize: '0.75rem',
          px: 0,
          minWidth: 0,
          '&:hover': { backgroundColor: 'transparent', color: '#16334a' },
        }}
      >
        {showTips ? 'Hide reading tips' : 'Reading tips'}
      </Button>
      <Collapse in={showTips}>
        <Box
          component="ul"
          sx={{
            m: 0,
            mt: 0.5,
            pl: 2.25,
            color: '#546669',
            fontSize: '0.78rem',
            lineHeight: 1.7,
          }}
        >
          {READING_TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}
