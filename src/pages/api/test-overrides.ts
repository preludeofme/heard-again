import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from 'next-auth/react'

/**
 * GET /api/test-overrides - Get current test override status
 * POST /api/test-overrides - Update test overrides
 * DELETE /api/test-overrides - Clear all test overrides
 * 
 * Test overrides allow bypassing normal permission and quota checks
 * for development and testing purposes.
 */

// Store overrides in memory (will reset on server restart)
// In production, this should use Redis or database
const testOverridesStore = new Map<string, TestOverrides>()

interface TestOverrides {
  bypassPermissionChecks: boolean
  mockPaidPlan: boolean
  unlimitedUsage: boolean
  debugMode: boolean
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession({ req })
  
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Only allow in development or for specific test users
  const isDev = process.env.NODE_ENV === 'development'
  const isTestUser = session.user.email?.includes('test') || 
                     session.user.email?.includes('dev') ||
                     session.user.email?.includes('local')
  
  if (!isDev && !isTestUser) {
    return res.status(403).json({ 
      error: 'Test overrides only available in development or for test users',
      env: process.env.NODE_ENV 
    })
  }

  const userId = session.user.email

  switch (req.method) {
    case 'GET': {
      const overrides = testOverridesStore.get(userId) || {
        bypassPermissionChecks: false,
        mockPaidPlan: false,
        unlimitedUsage: false,
        debugMode: false,
      }
      return res.status(200).json({ success: true, data: overrides })
    }

    case 'POST': {
      const current = testOverridesStore.get(userId) || {
        bypassPermissionChecks: false,
        mockPaidPlan: false,
        unlimitedUsage: false,
        debugMode: false,
      }
      
      const updated = {
        ...current,
        ...req.body,
      }
      
      testOverridesStore.set(userId, updated)
      
      console.log(`[TestOverrides] Updated for ${userId}:`, updated)
      
      return res.status(200).json({ 
        success: true, 
        data: updated,
        message: 'Test overrides updated. These will persist until server restart.'
      })
    }

    case 'DELETE': {
      testOverridesStore.delete(userId)
      console.log(`[TestOverrides] Cleared for ${userId}`)
      return res.status(200).json({ 
        success: true, 
        message: 'Test overrides cleared'
      })
    }

    default:
      return res.status(405).json({ error: 'Method not allowed' })
  }
}

// Helper function for other APIs to check test overrides
export function getTestOverrides(userEmail: string): TestOverrides {
  return testOverridesStore.get(userEmail) || {
    bypassPermissionChecks: false,
    mockPaidPlan: false,
    unlimitedUsage: false,
    debugMode: false,
  }
}
