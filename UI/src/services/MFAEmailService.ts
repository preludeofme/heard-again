import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { EmailService } from './EmailService'
import { logger } from '@/lib/logger'

const CODE_LENGTH = 6
const CODE_EXPIRY_MINUTES = 5
const BCRYPT_SALT_ROUNDS = 10

/**
 * Generate a 6-digit numeric MFA code using cryptographically secure random
 */
export function generateMFACode(): string {
  return String(crypto.randomInt(0, 999999)).padStart(CODE_LENGTH, '0')
}

/**
 * Store a hashed MFA code with expiry for the given user
 */
export async function storeMFACode(userId: string, code: string): Promise<void> {
  const hashedCode = await bcrypt.hash(code, BCRYPT_SALT_ROUNDS)
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000)

  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEmailCode: hashedCode,
      mfaEmailCodeExpires: expiresAt,
    },
  })

  logger.info({ userId }, 'MFA email code stored')
}

/**
 * Send a 6-digit MFA code to the user's registered email
 */
export async function sendMFACodeEmail(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true },
  })

  if (!user?.email) {
    logger.error({ userId }, 'Cannot send MFA email: user has no email')
    return false
  }

  const userName = user.displayName || user.email.split('@')[0]

  const emailSent = await EmailService.sendEmail({
    to: user.email,
    subject: 'Your Heard Again Verification Code',
    html: `
      <div style="font-family: 'Newsreader', serif, Arial; line-height: 1.6; color: #16334a; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #d0e3e6; border-radius: 8px;">
        <h2 style="color: #16334a; border-bottom: 2px solid #16334a; padding-bottom: 10px;">Verification Code</h2>
        <p>Hi ${userName},</p>
        <p>Your verification code is:</p>
        <div style="background-color: #f5f9fa; border: 1px solid #d0e3e6; border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center;">
          <span style="font-family: 'Courier New', monospace; font-size: 2rem; font-weight: bold; letter-spacing: 8px; color: #16334a;">${code}</span>
        </div>
        <p>This code will expire in <strong>${CODE_EXPIRY_MINUTES} minutes</strong>.</p>
        <p style="font-size: 0.9rem; color: #546669;">If you did not request this code, someone else may be trying to access your account. Please ignore this email and make sure your password is secure.</p>
        <p style="font-size: 0.8rem; color: #8a9a9d; margin-top: 40px; border-top: 1px solid #f0ede8; padding-top: 20px;">
          — Heard Again
        </p>
      </div>
    `,
  })

  if (emailSent) {
    logger.info({ userId, email: user.email }, 'MFA verification code email sent')
  } else {
    logger.error({ userId }, 'Failed to send MFA verification code email')
  }

  return emailSent
}

/**
 * Verify a user-supplied code against the stored hash.
 * The code is single-use — always cleared after verification attempt.
 */
export async function verifyMFACode(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEmailCode: true, mfaEmailCodeExpires: true },
  })

  if (!user?.mfaEmailCode || !user?.mfaEmailCodeExpires) {
    return false
  }

  const hashedCode = user.mfaEmailCode
  const expiresAt = user.mfaEmailCodeExpires

  // Single-use: always clear the code after an attempt
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEmailCode: null,
      mfaEmailCodeExpires: null,
    },
  })

  // Check expiry
  if (new Date() > expiresAt) {
    logger.info({ userId }, 'MFA email code expired')
    return false
  }

  // Check the code
  const isValid = await bcrypt.compare(code, hashedCode)

  if (isValid) {
    logger.info({ userId }, 'MFA email code verified successfully')
  } else {
    logger.info({ userId }, 'MFA email code verification failed')
  }

  return isValid
}
