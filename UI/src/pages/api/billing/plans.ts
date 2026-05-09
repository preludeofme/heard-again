import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/billing/plans - List available active plans
  GET: async (req, res) => {
    const plans = [
      {
        id: 'free',
        name: 'Self-Hosted',
        planType: 'FREE',
        pricing: {
          monthlyCents: 0,
          yearlyCents: 0,
          monthlyDisplay: '0.00',
          yearlyDisplay: '0.00',
        },
        entitlements: {
          tunnelEnabled: false,
          cloudGpuEnabled: false,
          cloudStorageEnabled: false,
          generationMinutesIncluded: 0,
          storageQuotaBytes: 0,
          memberQuota: 100,
          voiceProfileQuota: 5,
        },
        features: {
          prioritySupport: false,
          advancedAnalytics: false,
        },
      },
      {
        id: 'cloud_min',
        name: 'Cloud Access — Starter',
        planType: 'CLOUD',
        pricing: {
          monthlyCents: 999,
          yearlyCents: 9990,
          monthlyDisplay: '9.99',
          yearlyDisplay: '99.90',
        },
        entitlements: {
          tunnelEnabled: true,
          cloudGpuEnabled: true,
          cloudStorageEnabled: true,
          generationMinutesIncluded: 30,
          storageQuotaBytes: 10 * 1024 * 1024 * 1024,
          memberQuota: 1000,
          voiceProfileQuota: 50,
        },
        features: {
          prioritySupport: true,
          advancedAnalytics: true,
        },
      },
      {
        id: 'cloud_mid',
        name: 'Cloud Access — Family',
        planType: 'CLOUD',
        pricing: {
          monthlyCents: 1999,
          yearlyCents: 19990,
          monthlyDisplay: '19.99',
          yearlyDisplay: '199.90',
        },
        entitlements: {
          tunnelEnabled: true,
          cloudGpuEnabled: true,
          cloudStorageEnabled: true,
          generationMinutesIncluded: 60,
          storageQuotaBytes: 50 * 1024 * 1024 * 1024,
          memberQuota: 1000,
          voiceProfileQuota: 50,
        },
        features: {
          prioritySupport: true,
          advancedAnalytics: true,
        },
      },
      {
        id: 'cloud_max',
        name: 'Cloud Access — Legacy',
        planType: 'CLOUD',
        pricing: {
          monthlyCents: 3999,
          yearlyCents: 39990,
          monthlyDisplay: '39.99',
          yearlyDisplay: '399.90',
        },
        entitlements: {
          tunnelEnabled: true,
          cloudGpuEnabled: true,
          cloudStorageEnabled: true,
          generationMinutesIncluded: 999999, // unlimited representation
          storageQuotaBytes: 100 * 1024 * 1024 * 1024,
          memberQuota: 1000,
          voiceProfileQuota: 50,
        },
        features: {
          prioritySupport: true,
          advancedAnalytics: true,
        },
      }
    ]

    return successResponse(res, { plans })
  },
})
