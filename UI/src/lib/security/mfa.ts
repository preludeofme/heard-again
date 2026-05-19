import { logger } from '@/lib/logger'
import { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import speakeasy from 'speakeasy'

/**
 * Sensitive operations that require MFA verification
 */
export const SENSITIVE_OPERATIONS = {
  VOICE_TRAINING: 'voice_training',
  BULK_EXPORT: 'bulk_export',
  FAMILYSPACE_DELETION: 'familyspace_deletion',
  USER_DELETION: 'user_deletion',
  ADMIN_ACTIONS: 'admin_actions',
} as const

type SensitiveOperation = typeof SENSITIVE_OPERATIONS[keyof typeof SENSITIVE_OPERATIONS]

/**
 * Check if user has MFA enabled and verified
 */
export async function checkMFAStatus(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<{ user: any; mfaRequired: boolean }> {
  // Get the session token
  const sessionToken = await getToken({ 
    req, 
    secret: process.env.NEXTAUTH_SECRET 
  })

  if (!sessionToken?.id) {
    errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED')
    return { user: null, mfaRequired: false }
  }

  // Get user with MFA status using raw query to avoid type issues
  try {
    const user = await prisma.$queryRaw<any[]>`
      SELECT id, email, "mfaEnabled", "mfaSecret" 
      FROM "User" 
      WHERE id = ${sessionToken.id}
    `

    if (!user || user.length === 0) {
      errorResponse(res, 'User not found', 404, 'USER_NOT_FOUND')
      return { user: null, mfaRequired: false }
    }

    const userData = user[0]
    
    // ✅ Use real MFA status from database
    const mfaRequired = userData.mfaEnabled && !!userData.mfaSecret

    return { user: userData, mfaRequired }
  } catch (error) {
    logger.error('Error checking MFA status:', error)
    errorResponse(res, 'Internal server error', 500, 'MFA_CHECK_ERROR')
    return { user: null, mfaRequired: false }
  }
}

/**
 * Verify MFA token for sensitive operations using real TOTP
 */
export async function verifyMFAToken(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<boolean> {
  const mfaToken = req.headers['x-mfa-token'] as string || req.body?.mfaToken

  if (!mfaToken) {
    errorResponse(res, 'MFA token required for this operation', 403, 'MFA_REQUIRED')
    return false
  }

  // Validate token format
  if (mfaToken.length !== 6 || !/^\d{6}$/.test(mfaToken)) {
    errorResponse(res, 'Invalid MFA token format', 403, 'MFA_INVALID')
    return false
  }

  // Get the session token
  const sessionToken = await getToken({ 
    req, 
    secret: process.env.NEXTAUTH_SECRET 
  })

  if (!sessionToken?.id) {
    errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED')
    return false
  }

  try {
    // Get user's TOTP secret from database using raw query
    const user = await prisma.$queryRaw<any[]>`
      SELECT id, "mfaEnabled", "mfaSecret" 
      FROM "User" 
      WHERE id = ${sessionToken.id}
    `

    if (!user || user.length === 0) {
      errorResponse(res, 'User not found', 404, 'USER_NOT_FOUND')
      return false
    }

    const userData = user[0]

    // Check if MFA is enabled for this user
    if (!userData.mfaEnabled || !userData.mfaSecret) {
      errorResponse(res, 'MFA not configured for user', 403, 'MFA_NOT_CONFIGURED')
      return false
    }

    // ✅ Verify TOTP token using speakeasy
    const verified = speakeasy.totp.verify({
      secret: userData.mfaSecret,
      encoding: 'base32',
      token: mfaToken,
      window: 2, // Allow 2-step clock skew (±2 windows = ±60 seconds)
      time: Math.floor(Date.now() / 1000)
    })

    if (!verified) {
      // Log failed verification attempt for security monitoring
      const clientIP = req.headers['x-forwarded-for'] as string || 
                       req.headers['x-real-ip'] as string || 
                       'unknown'
      
      logger.warn('[MFA] Failed verification attempt', {
        userId: userData.id,
        timestamp: new Date().toISOString(),
        ip: clientIP
      })
      
      errorResponse(res, 'Invalid MFA token', 403, 'MFA_INVALID')
      return false
    }

    // Log successful verification
    const clientIP = req.headers['x-forwarded-for'] as string || 
                     req.headers['x-real-ip'] as string || 
                     'unknown'

    logger.info({ userId: userData.id, ip: clientIP, timestamp: new Date().toISOString() }, '[MFA] Successful verification')

    return true

  } catch (error) {
    logger.error('[MFA] Verification error:', error)
    errorResponse(res, 'MFA verification failed', 500, 'MFA_ERROR')
    return false
  }
}

/**
 * MFA enforcement middleware
 */
export function withMFAProtection(
  operation: SensitiveOperation,
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (process.env.NODE_ENV !== 'production') {
      return handler(req, res)
    }

    const { user, mfaRequired } = await checkMFAStatus(req, res)

    if (!user) {
      return // Error already sent
    }

    if (mfaRequired) {
      const isValid = await verifyMFAToken(req, res)
      if (!isValid) {
        return // Error already sent
      }
    }

    await handler(req, res)
  }
}

/**
 * Step-up authentication check for high-risk operations
 */
export async function requireStepUpAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  operation: SensitiveOperation
): Promise<boolean> {
  const { user, mfaRequired } = await checkMFAStatus(req, res)
  
  if (!user) {
    return false
  }

  if (mfaRequired) {
    return await verifyMFAToken(req, res)
  }

  return true
}
