import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchWithCSRF } from '@/lib/api-client'

// ============================================
// Types
// ============================================

interface UsageInfo {
  generationMinutesUsed: number
  generationMinutesQuota: number
  generationPercentUsed: number
  storageBytesUsed: number
  storageBytesQuota: number
  storagePercentUsed: number
  memberCount: number
  memberQuota: number
  voiceProfileCount: number
  voiceProfileQuota: number
}

interface FeatureFlags {
  tunnelEnabled: boolean
  cloudGpuEnabled: boolean
  cloudStorageEnabled: boolean
  prioritySupport: boolean
  advancedAnalytics: boolean
}

interface PlanInfo {
  id: string
  name: string
  planType: string
  pricing: {
    monthlyDisplay: string
  }
}

interface SubscriptionInfo {
  id: string
  billingStatus: string
  usage: UsageInfo
  plan: PlanInfo & { entitlements: FeatureFlags }
}

interface SubscriptionResponse {
  subscription: {
    id: string
    billingStatus: string
    renewalDate: string | null
    cancelledAt: string | null
    usage: {
      generationMinutesUsed: number
      storageBytesUsed: number
    }
  }
  plan: {
    id: string
    name: string
    planType: string
    pricing: {
      monthlyCents: number
      monthlyDisplay: string
    }
    entitlements: {
      tunnelEnabled: boolean
      cloudGpuEnabled: boolean
      cloudStorageEnabled: boolean
      generationMinutesIncluded: number
      storageQuotaBytes: number
      memberQuota: number
      voiceProfileQuota: number
    }
    features: {
      prioritySupport: boolean
      advancedAnalytics: boolean
    }
  }
}

interface UseEntitlementsReturn {
  isLoading: boolean
  isError: boolean
  error: Error | null
  planType: string | null
  planName: string | null
  billingStatus: string | null
  tierName: string

  // Feature flags
  canUseCloudGpu: boolean
  canUseTunnel: boolean
  canUseCloudStorage: boolean
  hasPrioritySupport: boolean
  hasAdvancedAnalytics: boolean

  // Quota info
  generationMinutesUsed: number
  generationMinutesQuota: number
  generationMinutesRemaining: number
  generationAtLimit: boolean
  generationPercentUsed: number

  storageBytesUsed: number
  storageBytesQuota: number
  storagePercentUsed: number

  memberQuota: number
  voiceProfileQuota: number

  // Raw data
  data: SubscriptionResponse | null

  // Refresh
  refresh: () => Promise<void>
}

// ============================================
// Hook
// ============================================

export function useEntitlements(): UseEntitlementsReturn {
  const [data, setData] = useState<SubscriptionResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchSubscription = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetchWithCSRF('/api/billing/subscription', {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        // 404 means no subscription — that's ok for free/self-hosted users
        if (response.status === 404) {
          setData(null)
          return
        }
        throw new Error(`Failed to load subscription: ${response.status}`)
      }

      const result = await response.json()
      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || 'Failed to load subscription')
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  const computed = useMemo(() => {
    if (!data) {
      return {
        planType: null,
        planName: null,
        billingStatus: null,
        tierName: 'Free',
        canUseCloudGpu: false,
        canUseTunnel: false,
        canUseCloudStorage: false,
        hasPrioritySupport: false,
        hasAdvancedAnalytics: false,
        generationMinutesUsed: 0,
        generationMinutesQuota: 0,
        generationMinutesRemaining: 0,
        generationAtLimit: false,
        generationPercentUsed: 0,
        storageBytesUsed: 0,
        storageBytesQuota: 0,
        storagePercentUsed: 0,
        memberQuota: 1,
        voiceProfileQuota: 0,
      }
    }

    const { subscription, plan } = data
    const genUsed = subscription.usage.generationMinutesUsed
    const genQuota = plan.entitlements.generationMinutesIncluded
    const storageUsed = subscription.usage.storageBytesUsed
    const storageQuota = Number(plan.entitlements.storageQuotaBytes)
    const freePlan = plan.planType === 'FREE'

    // Self-hosted (FREE) — unlimited = 0 means unlimited
    const effectiveGenQuota = freePlan && genQuota === 0 ? Infinity : genQuota
    const effectiveStorageQuota = freePlan && storageQuota === 0 ? Infinity : storageQuota

    return {
      planType: plan.planType,
      planName: plan.name,
      billingStatus: subscription.billingStatus,
      tierName: plan.planType === 'FREE' ? 'Self-Hosted' : plan.planType === 'CLOUD' ? 'Cloud' : plan.name,
      canUseCloudGpu: plan.entitlements.cloudGpuEnabled,
      canUseTunnel: plan.entitlements.tunnelEnabled,
      canUseCloudStorage: plan.entitlements.cloudStorageEnabled,
      hasPrioritySupport: plan.features.prioritySupport,
      hasAdvancedAnalytics: plan.features.advancedAnalytics,
      generationMinutesUsed: genUsed,
      generationMinutesQuota: effectiveGenQuota === Infinity ? 0 : effectiveGenQuota,
      generationMinutesRemaining: effectiveGenQuota === Infinity ? Infinity : Math.max(0, effectiveGenQuota - genUsed),
      generationAtLimit: effectiveGenQuota !== Infinity && genUsed >= effectiveGenQuota,
      generationPercentUsed: effectiveGenQuota === Infinity ? 0 : Math.min(100, Math.round((genUsed / effectiveGenQuota) * 100)),
      storageBytesUsed: storageUsed,
      storageBytesQuota: effectiveStorageQuota === Infinity ? 0 : effectiveStorageQuota,
      storagePercentUsed: effectiveStorageQuota === Infinity ? 0 : Math.min(100, Math.round((storageUsed / effectiveStorageQuota) * 100)),
      memberQuota: plan.entitlements.memberQuota,
      voiceProfileQuota: plan.entitlements.voiceProfileQuota,
    }
  }, [data])

  return {
    data,
    isLoading,
    isError: error !== null,
    error,
    refresh: fetchSubscription,
    ...computed,
  }
}
