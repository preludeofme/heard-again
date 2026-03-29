import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export interface MFASetupResult {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
}

export interface MFAVerifyResult {
  isValid: boolean
  error?: string
}

/**
 * Generate a new MFA secret for a user
 */
export async function generateMFASecret(userId: string): Promise<MFASetupResult> {
  const secret = speakeasy.generateSecret({
    length: 32,
    name: 'Heard Again',
  })
  
  // Get user email for the label
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  })
  
  if (!user) {
    throw new Error('User not found')
  }
  
  // Generate OTPAuth URL
  const otpauth = speakeasy.otpauthURL({
    secret: secret.base32,
    label: user.email,
    issuer: 'Heard Again',
    encoding: 'base32'
  })
  
  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(otpauth)
  
  // Generate backup codes (10 codes, 8 characters each)
  const backupCodes = generateBackupCodes(10)
  
  // Store encrypted secret and hashed backup codes temporarily
  // Will be confirmed after user verifies first TOTP code
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaSecret: encryptSecret(secret.base32),
      mfaBackupCodes: hashBackupCodes(backupCodes),
      mfaEnabled: false, // Not enabled until verified
    }
  })
  
  logger.info({ userId }, 'MFA setup initiated')
  
  return {
    secret: secret.base32, // Only returned once for setup
    qrCodeUrl,
    backupCodes // Plain text - user must save these
  }
}

/**
 * Verify TOTP code and enable MFA
 */
export async function verifyAndEnableMFA(
  userId: string,
  token: string,
  backupCode?: string
): Promise<MFAVerifyResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaSecret: true, mfaBackupCodes: true, mfaEnabled: true }
  })
  
  if (!user) {
    return { isValid: false, error: 'User not found' }
  }
  
  // If MFA already enabled, verify normally
  if (user.mfaEnabled && user.mfaSecret) {
    const secret = decryptSecret(user.mfaSecret)
    
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1 // Allow 1 step before/after for time drift
    })
    
    if (isValid) {
      return { isValid: true }
    }
    
    // Check backup code
    if (backupCode && user.mfaBackupCodes) {
      const hashedCodes: string[] = JSON.parse(user.mfaBackupCodes as string)
      const codeIndex = hashedCodes.findIndex(hashed => 
        verifyBackupCode(backupCode, hashed)
      )
      
      if (codeIndex !== -1) {
        // Remove used backup code
        hashedCodes.splice(codeIndex, 1)
        await prisma.user.update({
          where: { id: userId },
          data: { mfaBackupCodes: JSON.stringify(hashedCodes) }
        })
        
        logger.info({ userId }, 'MFA backup code used')
        return { isValid: true }
      }
    }
    
    return { isValid: false, error: 'Invalid verification code' }
  }
  
  // First-time verification (enabling MFA)
  if (user.mfaSecret) {
    const secret = decryptSecret(user.mfaSecret)
    
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1
    })
    
    if (isValid) {
      // Enable MFA
      await prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: true }
      })
      
      logger.info({ userId }, 'MFA enabled successfully')
      return { isValid: true }
    }
    
    return { isValid: false, error: 'Invalid verification code. Please try again.' }
  }
  
  return { isValid: false, error: 'MFA setup not initiated' }
}

/**
 * Disable MFA for a user
 */
export async function disableMFA(userId: string, password: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, mfaEnabled: true }
  })
  
  if (!user || !user.password) {
    return false
  }
  
  // Verify password before disabling MFA
  const bcrypt = await import('bcrypt')
  const isPasswordValid = await bcrypt.compare(password, user.password)
  
  if (!isPasswordValid) {
    return false
  }
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: null
    }
  })
  
  logger.info({ userId }, 'MFA disabled')
  return true
}

/**
 * Check if user has MFA enabled
 */
export async function isMFAEnabled(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true }
  })
  
  return user?.mfaEnabled ?? false
}

/**
 * Generate new backup codes
 */
export async function regenerateBackupCodes(
  userId: string,
  token: string
): Promise<string[] | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaSecret: true, mfaEnabled: true }
  })
  
  if (!user?.mfaEnabled || !user.mfaSecret) {
    return null
  }
  
  // Verify TOTP first
  const secret = decryptSecret(user.mfaSecret)
  const isValid = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1
  })
  
  if (!isValid) {
    return null
  }
  
  const newCodes = generateBackupCodes(10)
  
  await prisma.user.update({
    where: { id: userId },
    data: { mfaBackupCodes: hashBackupCodes(newCodes) }
  })
  
  logger.info({ userId }, 'MFA backup codes regenerated')
  return newCodes
}

// Helper functions
function generateBackupCodes(count: number): string[] {
  const codes: string[] = []
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // Removed confusing chars (0, O, 1, I, L)
  
  for (let i = 0; i < count; i++) {
    let code = ''
    for (let j = 0; j < 8; j++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
      if (j === 3) code += '-' // Add dash in middle for readability
    }
    codes.push(code)
  }
  
  return codes
}

function encryptSecret(secret: string): string {
  // Simple encryption using APP_KEY
  // In production, use proper encryption (AWS KMS, HashiCorp Vault, etc.)
  const key = process.env.APP_KEY || process.env.NEXTAUTH_SECRET || 'default-key'
  // XOR with key (simplified - use proper encryption in production)
  let encrypted = ''
  for (let i = 0; i < secret.length; i++) {
    encrypted += String.fromCharCode(
      secret.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    )
  }
  return Buffer.from(encrypted).toString('base64')
}

function decryptSecret(encrypted: string): string {
  const key = process.env.APP_KEY || process.env.NEXTAUTH_SECRET || 'default-key'
  const buffer = Buffer.from(encrypted, 'base64')
  let decrypted = ''
  for (let i = 0; i < buffer.length; i++) {
    decrypted += String.fromCharCode(
      buffer[i] ^ key.charCodeAt(i % key.length)
    )
  }
  return decrypted
}

function hashBackupCodes(codes: string[]): string {
  const bcrypt = require('bcrypt')
  const hashed = codes.map(code => bcrypt.hashSync(code.replace('-', ''), 10))
  return JSON.stringify(hashed)
}

function verifyBackupCode(code: string, hashed: string): boolean {
  const bcrypt = require('bcrypt')
  return bcrypt.compareSync(code.replace('-', ''), hashed)
}
