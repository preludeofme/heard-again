import crypto from 'crypto'
import { logger } from '@/lib/logger'

/**
 * Encryption configuration
 */
interface EncryptionConfig {
  algorithm: string
  keyLength: number
  ivLength: number
  tagLength: number
}

const ENCRYPTION_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  tagLength: 16,
}

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required for field encryption')
  }
  
  // Ensure key is exactly 32 bytes for AES-256
  return Buffer.from(key.padEnd(32, '0').substring(0, 32), 'utf8')
}

/**
 * Encrypt sensitive data
 */
export function encryptField(plaintext: string): string {
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength)
    
    const cipher = crypto.createCipheriv(ENCRYPTION_CONFIG.algorithm, key, iv)
    
    let encrypted = cipher.update(plaintext, 'utf8')
    encrypted = Buffer.concat([encrypted, cipher.final()])
    
    const tag = (cipher as any).getAuthTag()
    
    // Combine iv + tag + encrypted data for storage
    const combined = Buffer.concat([iv, tag, encrypted])
    
    return combined.toString('base64')
  } catch (error) {
    logger.error({ error }, 'Failed to encrypt field')
    throw new Error('Encryption failed')
  }
}

/**
 * Decrypt sensitive data
 */
export function decryptField(encryptedData: string): string {
  try {
    const key = getEncryptionKey()
    const combined = Buffer.from(encryptedData, 'base64')
    
    // Extract iv, tag, and encrypted data
    const iv = combined.slice(0, ENCRYPTION_CONFIG.ivLength)
    const tag = combined.slice(ENCRYPTION_CONFIG.ivLength, ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.tagLength)
    const encrypted = combined.slice(ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.tagLength)
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_CONFIG.algorithm, key, iv)
    ;(decipher as any).setAuthTag(tag)
    
    let decrypted = decipher.update(encrypted)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    
    return decrypted.toString('utf8')
  } catch (error) {
    logger.error({ error }, 'Failed to decrypt field')
    throw new Error('Decryption failed')
  }
}

/**
 * Check if a string appears to be encrypted (base64 format)
 */
export function isEncrypted(data: string): boolean {
  try {
    const decoded = Buffer.from(data, 'base64')
    // Check if it's long enough to contain iv + tag + some data
    return decoded.length >= (ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.tagLength + 1)
  } catch {
    return false
  }
}

/**
 * Sensitive field types that should be encrypted
 */
export const SENSITIVE_FIELDS = {
  STORY_CONTENT: 'story_content',
  TRANSCRIPT: 'transcript',
  VOICE_METADATA: 'voice_metadata',
  PERSON_NOTES: 'person_notes',
} as const

type SensitiveFieldType = typeof SENSITIVE_FIELDS[keyof typeof SENSITIVE_FIELDS]

/**
 * Field encryption middleware for Prisma
 */
export function createFieldEncryptionMiddleware() {
  return {
    async beforeCreate(params: any) {
      return encryptSensitiveFields(params)
    },
    
    async beforeUpdate(params: any) {
      return encryptSensitiveFields(params)
    },
    
    async afterFind(result: any) {
      return decryptSensitiveFields(result)
    },
    
    async afterFindMany(result: any[]) {
      if (Array.isArray(result)) {
        return result.map(decryptSensitiveFields)
      }
      return result
    },
  }
}

/**
 * Encrypt sensitive fields before database operations
 */
function encryptSensitiveFields(params: any): any {
  if (!params.data) return params
  
  const data = { ...params.data }
  
  // Encrypt story content
  if (data.content && typeof data.content === 'string') {
    data.content = encryptField(data.content)
  }
  
  // Encrypt transcripts
  if (data.transcript && typeof data.transcript === 'string') {
    data.transcript = encryptField(data.transcript)
  }
  
  // Encrypt voice profile metadata
  if (data.styleParams && typeof data.styleParams === 'string') {
    data.styleParams = encryptField(data.styleParams)
  }
  
  return { ...params, data }
}

/**
 * Decrypt sensitive fields after database operations
 */
function decryptSensitiveFields(result: any): any {
  if (!result) return result
  
  const decrypted = { ...result }
  
  // Decrypt story content
  if (decrypted.content && typeof decrypted.content === 'string' && isEncrypted(decrypted.content)) {
    try {
      decrypted.content = decryptField(decrypted.content)
    } catch (error) {
      logger.warn({ field: 'content', error: 'Failed to decrypt field' })
    }
  }
  
  // Decrypt transcripts
  if (decrypted.transcript && typeof decrypted.transcript === 'string' && isEncrypted(decrypted.transcript)) {
    try {
      decrypted.transcript = decryptField(decrypted.transcript)
    } catch (error) {
      logger.warn({ field: 'transcript', error: 'Failed to decrypt field' })
    }
  }
  
  // Decrypt voice profile metadata
  if (decrypted.styleParams && typeof decrypted.styleParams === 'string' && isEncrypted(decrypted.styleParams)) {
    try {
      decrypted.styleParams = decryptField(decrypted.styleParams)
    } catch (error) {
      logger.warn({ field: 'styleParams', error: 'Failed to decrypt field' })
    }
  }
  
  return decrypted
}
