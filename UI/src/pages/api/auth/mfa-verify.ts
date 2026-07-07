import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { generateMFACode, sendMFACodeEmail, storeMFACode, verifyMFACode } from '@/services/MFAEmailService'
import { decryptSecret } from '@/lib/security/mfa-service'
import speakeasy from 'speakeasy'
import crypto from 'crypto'

// Rate limiting state (in-memory; resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

function checkRateLimit(email: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(email)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(email, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false
  }

  entry.count++
  return true
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action, email, code } = req.body

  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }

  if (action === 'send-code') {
    return await handleSendCode(email, res)
  }

  if (action === 'verify') {
    return await handleVerify(req, res)
  }

  return res.status(400).json({ error: 'Invalid action. Use "send-code" or "verify".' })
}

async function handleSendCode(email: string, res: NextApiResponse) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, mfaEnabled: true, mfaMethod: true },
    })

    if (!user || !user.mfaEnabled || user.mfaMethod !== 'email') {
      return res.status(400).json({ error: 'Email MFA is not enabled for this account' })
    }

    const code = generateMFACode()
    await storeMFACode(user.id, code)
    await sendMFACodeEmail(user.id, code)

    logger.info({ userId: user.id, email }, 'MFA sign-in code sent')

    return res.status(200).json({ success: true, message: 'Code sent to your email' })
  } catch (error) {
    logger.error({ email, error }, 'Failed to send MFA code')
    return res.status(500).json({ error: 'Failed to send verification code' })
  }
}

async function handleVerify(req: NextApiRequest, res: NextApiResponse) {
  const { email, code } = req.body

  if (!code) {
    return res.status(400).json({ error: 'Verification code is required' })
  }

  // Rate limiting
  if (!checkRateLimit(email)) {
    logger.warn({ email }, 'MFA rate limit exceeded')
    return res.status(429).json({ error: 'Too many attempts. Please try again later.' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        mfaEnabled: true,
        mfaMethod: true,
        mfaSecret: true,
        mfaEmailCode: true,
        mfaEmailCodeExpires: true,
      },
    })

    if (!user) {
      return res.status(400).json({ error: 'Invalid request' })
    }

    let isValid = false

    if (user.mfaMethod === 'email') {
      isValid = await verifyMFACode(user.id, code)
    } else if (user.mfaMethod === 'totp' && user.mfaSecret) {
      const secret = decryptSecret(user.mfaSecret)
      isValid = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: code,
        window: 1,
      })
    }

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired verification code' })
    }

    // Generate a temporary token that allows bypassing MFA for this session
    // We use a crypto-random token stored in the session/JWT approach
    // For simplicity, we return a one-time token that the sign-in flow can use
    const tempToken = crypto.randomUUID()

    // Store the temporary token in the user record (as a session marker)
    // On successful MFA, we mark that this user has passed MFA for this auth flow
    // The authorize callback checks for this
    await prisma.user.update({
      where: { id: user.id },
      data: {
        // We store the temp token in the mfaEmailCode field temporarily (re-used)
        // The authorize callback in auth.ts will check for this flow
        mfaEmailCode: tempToken, // temporary session token for mfa bypass
        mfaEmailCodeExpires: new Date(Date.now() + 5 * 60 * 1000), // 5 min expiry
      },
    })

    logger.info({ userId: user.id }, 'MFA challenge passed, temp token issued')

    return res.status(200).json({
      success: true,
      tempToken,
      userId: user.id,
      message: 'MFA verified successfully',
    })
  } catch (error) {
    logger.error({ email, error }, 'MFA verification error')
    return res.status(500).json({ error: 'Verification failed' })
  }
}

export default handler
