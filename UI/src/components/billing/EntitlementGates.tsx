import React from 'react'
import { Box, Typography, Button, LinearProgress } from '@mui/material'
import { useEntitlements } from '@/hooks/useEntitlements'

// ============================================
// FeatureGate — hide/show UI based on plan
// ============================================

interface FeatureGateProps {
  feature: 'cloud_gpu' | 'tunnel' | 'cloud_storage' | 'priority_support' | 'advanced_analytics'
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const {
    canUseCloudGpu,
    canUseTunnel,
    canUseCloudStorage,
    hasPrioritySupport,
    hasAdvancedAnalytics,
    isLoading,
  } = useEntitlements()

  const featureMap: Record<string, boolean> = {
    cloud_gpu: canUseCloudGpu,
    tunnel: canUseTunnel,
    cloud_storage: canUseCloudStorage,
    priority_support: hasPrioritySupport,
    advanced_analytics: hasAdvancedAnalytics,
  }

  const entitled = featureMap[feature] ?? false

  if (isLoading) return null
  if (!entitled) return fallback ? <>{fallback}</> : null
  return <>{children}</>
}

// ============================================
// UsageBar — visual progress with upgrade CTA
// ============================================

interface UsageBarProps {
  resource: 'generation' | 'storage'
  warningThreshold?: number
  showLabel?: boolean
  size?: 'small' | 'medium'
}

export function UsageBar({ resource, warningThreshold = 0.8, showLabel = true, size = 'medium' }: UsageBarProps) {
  const {
    generationMinutesUsed,
    generationMinutesQuota,
    generationPercentUsed,
    generationAtLimit,
    generationMinutesRemaining,
    storageBytesUsed,
    storageBytesQuota,
    storagePercentUsed,
    isLoading,
    tierName,
  } = useEntitlements()

  if (isLoading) return null

  const isGeneration = resource === 'generation'
  const percentUsed = isGeneration ? generationPercentUsed : storagePercentUsed
  const atLimit = isGeneration ? generationAtLimit : false
  const quota = isGeneration ? generationMinutesQuota : storageBytesQuota

  // Unlimited (self-hosted free plan)
  if (quota === 0 && percentUsed === 0) {
    if (!showLabel) return null
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" sx={{ color: '#999' }}>
          {isGeneration ? 'Unlimited generation' : 'Unlimited storage'}
        </Typography>
        <Typography variant="caption" sx={{ color: '#546669' }}>
          ({tierName})
        </Typography>
      </Box>
    )
  }

  const color = atLimit ? 'error' as const : percentUsed > warningThreshold * 100 ? 'warning' as const : 'primary' as const

  return (
    <Box>
      {showLabel && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#546669' }}>
            {isGeneration
              ? `${generationMinutesUsed} min used`
              : `${formatBytes(storageBytesUsed)} used`
            }
          </Typography>
          <Typography variant="caption" sx={{ color: '#999' }}>
            {isGeneration
              ? `of ${quota} min`
              : `of ${formatBytes(storageBytesQuota)}`
            }
          </Typography>
        </Box>
      )}
      <LinearProgress
        variant="determinate"
        value={Math.min(percentUsed, 100)}
        color={color}
        sx={{
          height: size === 'small' ? 4 : 8,
          borderRadius: 4,
          backgroundColor: '#f0ebe4',
          '& .MuiLinearProgress-bar': {
            borderRadius: 4,
          },
        }}
      />
      {atLimit && (
        <Box sx={{ mt: 1.5, p: 2, bgcolor: '#fff4e5', borderRadius: 2, border: '1px solid #ffe0b2' }}>
          <Typography variant="body2" sx={{ color: '#e65100', mb: 1 }}>
            {isGeneration
              ? 'You\'ve reached your monthly generation limit.'
              : 'You\'ve reached your storage limit.'
            }
          </Typography>
          <Button
            href="/account?tab=subscription"
            size="small"
            variant="outlined"
            sx={{
              textTransform: 'none',
              borderColor: '#e65100',
              color: '#e65100',
              '&:hover': { borderColor: '#bf360c', backgroundColor: '#fff4e5' },
            }}
          >
            Upgrade plan →
          </Button>
        </Box>
      )}
    </Box>
  )
}

// ============================================
// UpgradePrompt — call-to-action banner
// ============================================

interface UpgradePromptProps {
  message?: string
  compact?: boolean
}

export function UpgradePrompt({ message, compact = false }: UpgradePromptProps) {
  const { tierName } = useEntitlements()

  if (tierName !== 'Self-Hosted') return null

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: '#f6f3ee', borderRadius: 2 }}>
        <Typography variant="caption" sx={{ color: '#546669', flexGrow: 1 }}>
          {message || 'Unlock cloud features with a hosted plan.'}
        </Typography>
        <Button href="/account?tab=subscription" size="small" variant="text" sx={{ textTransform: 'none', color: '#16334a' }}>
          Upgrade
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3, bgcolor: '#f6f3ee', borderRadius: 3, textAlign: 'center' }}>
      <Typography variant="body1" sx={{ color: '#16334a', mb: 1.5 }}>
        {message || 'This feature requires a Cloud plan.'}
      </Typography>
      <Button
        href="/account?tab=subscription"
        variant="contained"
        sx={{
          textTransform: 'none',
          backgroundColor: '#16334a',
          '&:hover': { backgroundColor: '#2e4a62' },
        }}
      >
        See plans and pricing →
      </Button>
    </Box>
  )
}

// ============================================
// Helpers
// ============================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
