# Usage Tracking & Feature Gating System

## Overview

Three layers: **track** usage, **check** at point of action, **gate** the UI.

```
┌─────────────────────┐
│  1. Track Usage      │  ← Increment on every billable action
├─────────────────────┤
│  2. Check at Action   │  ← Middleware/before hooks on APIs
├─────────────────────┤
│  3. Gate the UI      │  ← Hooks/components that hide/show features
└─────────────────────┘
```

## 1. Usage Tracking

### Where to Track

| Action | Tracked Metric | Method |
|--------|---------------|--------|
| Voice generation (text → audio) | Minutes of audio generated | Increment on generation complete |
| File upload / asset storage | Bytes stored | Increment on upload |
| Member invites | Member count | Check on invite |
| Voice profile creation | Profile count | Check on create |

### Voice Generation Tracking

The current `GET /api/billing/usage` aggregates from `VoiceGenerationJob` on every request by computing `durationSeconds` across completed jobs since `lastBillingResetAt`. This is already correct — but there's no **gating** check before queuing a new job.

### Where to Increment

Add a tiny incremented counter on the `Subscription` row itself:

```prisma
model Subscription {
  // existing fields...
  generationMinutesUsed Int    @default(0)  // incremented on job completion
  storageBytesUsed      BigInt @default(0)  // incremented on asset upload
  lastBillingResetAt    DateTime            // reset on renewal
}
```

The existing schema already has these fields.

**On job completion** (when the TTS handler returns success):
```typescript
// In the voice generation completion handler
await prisma.subscription.update({
  where: { familyspaceId },
  data: {
    generationMinutesUsed: {
      increment: Math.ceil(actualDurationSeconds / 60)
    }
  }
})
```

### Reset on Renewal

Already handled in `webhook.ts`:
```typescript
generationMinutesUsed: 0, // Reset usage for new period
```

## 2. Feature Gating — Backend

### Middleware Pattern

Create a reusable gating helper in `lib/entitlements.ts`:

```typescript
// lib/entitlements.ts
import { prisma } from './prisma'

type QuotaCheck = {
  familyspaceId: string
  resource: 'generation' | 'storage' | 'members' | 'voiceProfiles'
}

export async function checkQuota({ familyspaceId, resource }: QuotaCheck) {
  const subscription = await prisma.subscription.findUnique({
    where: { familyspaceId },
    include: { plan: true },
  })

  if (!subscription) return { allowed: false, reason: 'No subscription' }

  switch (resource) {
    case 'generation': {
      if (subscription.plan.generationMinutesIncluded === 0) {
        return { allowed: false, reason: 'Generation not included in your plan' }
      }
      if (subscription.generationMinutesUsed >= subscription.plan.generationMinutesIncluded) {
        return { allowed: false, reason: 'Monthly generation limit reached' }
      }
      return { allowed: true }
    }
    // ... storage, members, voiceProfiles
  }
}
```

### Where to Gate

**Voice Generation API** — before queuing a TTS job:
```typescript
// In the voice generation endpoint
const quota = await checkQuota({ familyspaceId, resource: 'generation' })
if (!quota.allowed) {
  return res.status(402).json({ error: quota.reason, upgradeUrl: '/account' })
}
```

Plan-level feature flags (tunnel, GPU, storage) are **boolean gates**:
```typescript
export async function checkFeature(familyspaceId: string, feature: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where: { familyspaceId },
    include: { plan: true },
  })
  if (!sub) return false
  
  switch (feature) {
    case 'cloud_gpu': return sub.plan.cloudGpuEnabled
    case 'tunnel': return sub.plan.tunnelEnabled
    case 'priority_support': return sub.plan.prioritySupport
    default: return false
  }
}
```

## 3. Feature Gating — Frontend

### Hook-based Pattern

Create `useEntitlements()` hook that wraps the subscription API:

```typescript
// hooks/useEntitlements.ts
export function useEntitlements() {
  const { data, error, isLoading } = useSWR('/api/billing/subscription')
  
  return {
    // Plan info
    planType: data?.plan?.planType,
    
    // Boolean feature checks
    canUseCloudGpu: !!data?.plan?.entitlements?.cloudGpuEnabled,
    canUseTunnel: !!data?.plan?.entitlements?.tunnelEnabled,
    
    // Quota usage
    generationMinutesRemaining: (data?.plan?.entitlements?.generationMinutesIncluded || 0) 
      - (data?.subscription?.usage?.generationMinutesUsed || 0),
    
    // Is something at limit?
    generationAtLimit: computed from above,
    storagePercentUsed: computed from above,
    
    // Helper
    isLoading,
    isError: !!error,
  }
}
```

### UI Gating Components

```typescript
// components/FeatureGate.tsx
function FeatureGate({ 
  feature,       // e.g. 'cloud_gpu', 'tunnel'  
  fallback,      // Optional: what to show if not entitled
  children 
}) {
  const { canUseCloudGpu, canUseTunnel, isLoading } = useEntitlements()
  
  const entitled = feature === 'cloud_gpu' ? canUseCloudGpu : canUseTunnel
  
  if (isLoading) return null // or skeleton
  if (!entitled) return fallback || null
  return children
}
```

**Usage progress bar + upgrade prompt** when limit is approaching:

```typescript
// components/UsageBar.tsx
function UsageBar({ resource, warningThreshold = 0.8 }) {
  const usage = useEntitlements()
  const percent = resource === 'generation' 
    ? usage.generationPercentUsed 
    : usage.storagePercentUsed

  return (
    <Box>
      <LinearProgress variant="determinate" value={Math.min(percent, 100)} 
        color={percent > 100 ? 'error' : percent > warningThreshold ? 'warning' : 'primary'} />
      {percent > 100 && <Button href="/account">Upgrade plan →</Button>}
    </Box>
  )
}
```

## 4. Implementation Order

1. **Backend quota check helper** (`lib/entitlements.ts`)
2. **Gate voice generation API** with quota check before queuing
3. **`useEntitlements()` hook** on frontend
4. **`UsageBar` component** showing remaining minutes on voice gen page
5. **`FeatureGate` component** for hiding cloud-only features
6. **Generate-and-lock** — when hitting limit, show graceful paywall with upgrade link

## 5. Plans & Pricing Matrix

| Feature | Self-Hosted (FREE) | Starter ($9.99) | Family ($19.99) | Legacy ($39.99) |
|---------|-------------------|-----------------|-----------------|-----------------|
| Hosting | Self | Cloud | Cloud | Cloud |
| Gen minutes | Unlimited* | 30 min | 60 min | Unlimited |
| Voice profiles | Unlimited* | 50 | 50 | 50 |
| Members | Unlimited* | Unlimited | Unlimited | Unlimited |
| Storage | Your hardware | Managed | Managed | Managed |
| Priority | — | — | Processing | Support |
| GPU | Your GPU | ✓ | ✓ | ✓ |

*Self-hosted = unlimited because you're using your own hardware/resources.
