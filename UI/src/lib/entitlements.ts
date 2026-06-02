import { prisma } from './prisma'

// ============================================
// Types
// ============================================

export type QuotaResource =
  | 'generation'
  | 'storage'
  | 'members'
  | 'voiceProfiles'

export type QuotaResult =
  | { allowed: true }
  | { allowed: false; reason: string; upgradeUrl: string }

export type FeatureFlag =
  | 'cloud_gpu'
  | 'tunnel'
  | 'cloud_storage'
  | 'priority_support'
  | 'advanced_analytics'

// ============================================
// Quota Checks
// ============================================

/**
 * Check whether a familyspace has remaining quota for a billable resource.
 * Returns {allowed: true} or a 402-compatible rejection with upgrade link.
 */
export async function checkQuota(
  familyspaceId: string,
  resource: QuotaResource
): Promise<QuotaResult> {
  const subscription = await prisma.subscription.findUnique({
    where: { familyspaceId },
    include: { plan: true },
  })

  if (!subscription) {
    return {
      allowed: false,
      reason: 'No active subscription found. Create a plan to get started.',
      upgradeUrl: '/account?tab=subscription',
    }
  }

  switch (resource) {
    case 'generation': {
      const quota = subscription.plan.generationMinutesIncluded
      const used = subscription.generationMinutesUsed

      if (quota === 0 && subscription.plan.planType !== 'FREE') {
        return {
          allowed: false,
          reason: 'Voice generation is not included in your current plan.',
          upgradeUrl: '/account?tab=subscription',
        }
      }

      // Self-hosted (FREE) plans have unlimited generation — 0 = unlimited
      if (quota === 0 && subscription.plan.planType === 'FREE') {
        return { allowed: true }
      }

      if (used >= quota) {
        return {
          allowed: false,
          reason: `You've used all ${quota} minutes of voice generation this period. Upgrade to keep generating.`,
          upgradeUrl: '/account?tab=subscription',
        }
      }

      return { allowed: true }
    }

    case 'storage': {
      const storageQuota = Number(subscription.plan.storageQuotaBytes)
      const storageUsed = Number(subscription.storageBytesUsed)

      if (storageQuota === 0 && subscription.plan.planType === 'FREE') {
        return { allowed: true }
      }

      if (storageQuota === 0) {
        return {
          allowed: false,
          reason: 'Cloud storage is not included in your current plan.',
          upgradeUrl: '/account?tab=subscription',
        }
      }

      if (storageUsed >= storageQuota) {
        return {
          allowed: false,
          reason: `You've used all your storage quota. Upgrade for more space.`,
          upgradeUrl: '/account?tab=subscription',
        }
      }

      return { allowed: true }
    }

    case 'members': {
      const memberCount = await prisma.membership.count({
        where: {
          familyspaceId,
          status: 'ACTIVE',
        },
      })

      const memberQuota = subscription.plan.memberQuota

      if (memberQuota === 0 && subscription.plan.planType === 'FREE') {
        return { allowed: true }
      }

      if (memberCount >= memberQuota) {
        return {
          allowed: false,
          reason: `Your plan supports up to ${memberQuota} active members. Upgrade to add more.`,
          upgradeUrl: '/account?tab=subscription',
        }
      }

      return { allowed: true }
    }

    case 'voiceProfiles': {
      const profileCount = await prisma.voiceProfile.count({
        where: {
          familyspaceId,
          deletedAt: null,
        },
      })

      const profileQuota = subscription.plan.voiceProfileQuota

      if (profileQuota === 0 && subscription.plan.planType === 'FREE') {
        return { allowed: true }
      }

      if (profileCount >= profileQuota) {
        return {
          allowed: false,
          reason: `Your plan supports up to ${profileQuota} voice profiles. Upgrade to create more.`,
          upgradeUrl: '/account?tab=subscription',
        }
      }

      return { allowed: true }
    }

    default:
      return { allowed: true }
  }
}

// ============================================
// Feature Flag Checks
// ============================================

/**
 * Check whether a familyspace has access to a boolean-gated feature.
 */
export async function checkFeature(
  familyspaceId: string,
  feature: FeatureFlag
): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { familyspaceId },
    include: { plan: true },
  })

  if (!subscription || !subscription.plan) return false

  switch (feature) {
    case 'cloud_gpu':
      return subscription.plan.cloudGpuEnabled
    case 'tunnel':
      return subscription.plan.tunnelEnabled
    case 'cloud_storage':
      return subscription.plan.cloudStorageEnabled
    case 'priority_support':
      return subscription.plan.prioritySupport
    case 'advanced_analytics':
      return subscription.plan.advancedAnalytics
    default:
      return false
  }
}

// ============================================
// Usage Increment Helpers
// ============================================

/**
 * Increment generation minutes used after a successful TTS job completes.
 */
export async function incrementGenerationMinutes(
  familyspaceId: string,
  durationSeconds: number
) {
  await prisma.subscription.update({
    where: { familyspaceId },
    data: {
      generationMinutesUsed: {
        increment: Math.ceil(durationSeconds / 60),
      },
    },
  })
}

/**
 * Increment storage bytes used after an asset upload.
 */
export async function incrementStorageBytes(
  familyspaceId: string,
  bytes: number
) {
  await prisma.subscription.update({
    where: { familyspaceId },
    data: {
      storageBytesUsed: {
        increment: bytes,
      },
    },
  })

  // Also update the familyspace-level storage quota tracker
  await prisma.familyspace.update({
    where: { id: familyspaceId },
    data: {
      storageQuotaBytes: {
        increment: bytes,
      },
    },
  })
}
