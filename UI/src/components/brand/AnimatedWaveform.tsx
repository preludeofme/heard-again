import React from 'react'
import { Box, BoxProps } from '@mui/material'
import { keyframes } from '@emotion/react'

// Slow, gentle breathing waveform animation keyframes
const waveAnimation = keyframes`
  0%, 100% {
    transform: scaleY(0.70);
  }
  50% {
    transform: scaleY(1.30);
  }
`

// Exact positions, base sizes, and gradient color palette from the original high-res asset logo-large.png
const BARS = [
  { x: 515, yCenter: 984.5, w: 185, h: 188, color: '#2B228A' }, // Indigo
  { x: 787, yCenter: 984.5, w: 185, h: 278, color: '#2B228A' }, // Indigo
  { x: 1058, yCenter: 984.5, w: 185, h: 619, color: '#0E348C' }, // Navy
  { x: 1330, yCenter: 984.5, w: 185, h: 1018, color: '#014786' }, // Blue
  { x: 1603, yCenter: 984.5, w: 185, h: 619, color: '#045982' }, // Teal-blue
  { x: 1875, yCenter: 984.5, w: 185, h: 278, color: '#156971' }, // Teal
  { x: 2147, yCenter: 984.5, w: 185, h: 619, color: '#377F5E' }, // Forest sage
  { x: 2419, yCenter: 984.5, w: 185, h: 1133, color: '#4B8655' }, // Sage green
  { x: 2691, yCenter: 984.5, w: 185, h: 619, color: '#88953D' }, // Olive
  { x: 2962, yCenter: 984.5, w: 185, h: 278, color: '#F1A72E' }, // Warm gold
  { x: 3234, yCenter: 984.5, w: 185, h: 188, color: '#FAA62E' }, // Gold
]

interface AnimatedWaveformProps extends BoxProps {
  height?: number | string
}

/**
 * Premium SVG-based Animated Waveform Logo
 * Renders the brand logo natively in vector format with smooth, GPU-accelerated CSS keyframe animations.
 * Completely scalable, crisp at any resolution, and has zero network overhead compared to GIFs.
 */
export function AnimatedWaveform({ height = 72, sx, ...props }: AnimatedWaveformProps) {
  return (
    <Box
      component="svg"
      viewBox="0 0 3750 1969"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      sx={{
        height,
        width: 'auto',
        display: 'block',
        overflow: 'visible',
        ...sx,
      }}
      {...props}
    >
      {BARS.map((bar, i) => {
        const xLeft = bar.x - bar.w / 2
        const yTop = bar.yCenter - bar.h / 2
        const rx = bar.w / 2 // Perfect capsule shape (half circles on ends)

        return (
          <Box
            key={i}
            component="rect"
            x={xLeft}
            y={yTop}
            width={bar.w}
            height={bar.h}
            rx={rx}
            fill={bar.color}
            sx={{
              animation: `${waveAnimation} 6s ease-in-out infinite`,
              animationDelay: `${i * 0.35}s`, // Ripple effect traversing from left to right
              transformOrigin: `${bar.x}px ${bar.yCenter}px`,
            }}
          />
        )
      })}
    </Box>
  )
}
