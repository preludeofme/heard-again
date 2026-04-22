import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { generateMFASecret, verifyAndEnableMFA, disableMFA, isMFAEnabled, regenerateBackupCodes } from '@/lib/security/mfa-service'
import { logger } from '@/lib/logger'
import { withCSRFProtection } from '@/lib/security/csrf'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const userId = session.user.id

  try {
    switch (req.method) {
      case 'POST':
        return await setupMFA(req, res, userId)
      case 'PUT':
        return await verifyMFA(req, res, userId)
      case 'DELETE':
        return await disableUserMFA(req, res, userId)
      case 'GET':
        return await getMFAStatus(req, res, userId)
      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    logger.error({ userId, error }, 'MFA API error')
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function setupMFA(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const result = await generateMFASecret(userId)
    
    logger.info({ userId }, 'MFA setup initiated')
    
    return res.status(200).json({
      qrCode: result.qrCodeUrl,
      // Don't return secret - user must scan QR code
      backupCodes: result.backupCodes // One-time display
    })
  } catch (error) {
    logger.error({ userId, error }, 'MFA setup failed')
    return res.status(500).json({ error: 'Failed to setup MFA' })
  }
}

async function verifyMFA(req: NextApiRequest, res: NextApiResponse, userId: string) {
  const { code, backupCode } = req.body
  
  if (!code) {
    return res.status(400).json({ error: 'Verification code required' })
  }
  
  const result = await verifyAndEnableMFA(userId, code, backupCode)
  
  if (result.isValid) {
    logger.info({ userId }, 'MFA enabled successfully')
    return res.status(200).json({ success: true, message: 'MFA enabled' })
  } else {
    return res.status(400).json({ error: result.error || 'Invalid code' })
  }
}

async function disableUserMFA(req: NextApiRequest, res: NextApiResponse, userId: string) {
  const { password } = req.body
  
  if (!password) {
    return res.status(400).json({ error: 'Password required to disable MFA' })
  }
  
  const success = await disableMFA(userId, password)
  
  if (success) {
    logger.info({ userId }, 'MFA disabled')
    return res.status(200).json({ success: true, message: 'MFA disabled' })
  } else {
    return res.status(400).json({ error: 'Invalid password' })
  }
}

async function getMFAStatus(req: NextApiRequest, res: NextApiResponse, userId: string) {
  const enabled = await isMFAEnabled(userId)
  return res.status(200).json({ enabled })
}
export default withCSRFProtection(handler)
