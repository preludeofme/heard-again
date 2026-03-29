import bcrypt from 'bcrypt'
import { z } from 'zod'

// Password policy configuration
const PASSWORD_CONFIG = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxConsecutiveChars: 3, // Prevent "aaaa" or "1234"
  commonPasswords: new Set([
    'password', '123456', '12345678', 'qwerty', 'abc123',
    'letmein', 'welcome', 'admin', 'password123', 'user'
  ]),
}

// Zod schema for password validation
export const passwordSchema = z
  .string()
  .min(PASSWORD_CONFIG.minLength, `Password must be at least ${PASSWORD_CONFIG.minLength} characters`)
  .max(PASSWORD_CONFIG.maxLength, `Password must not exceed ${PASSWORD_CONFIG.maxLength} characters`)
  .refine(
    (password) => !PASSWORD_CONFIG.commonPasswords.has(password.toLowerCase()),
    'Password is too common and easily guessed'
  )
  .refine(
    (password) => {
      if (PASSWORD_CONFIG.requireUppercase && !/[A-Z]/.test(password)) return false
      if (PASSWORD_CONFIG.requireLowercase && !/[a-z]/.test(password)) return false
      if (PASSWORD_CONFIG.requireNumbers && !/[0-9]/.test(password)) return false
      if (PASSWORD_CONFIG.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false
      return true
    },
    'Password must contain uppercase, lowercase, number, and special character'
  )
  .refine(
    (password) => {
      // Check for consecutive characters (prevents "aaaa", "1234")
      for (let i = 0; i < password.length - PASSWORD_CONFIG.maxConsecutiveChars; i++) {
        const slice = password.slice(i, i + PASSWORD_CONFIG.maxConsecutiveChars + 1)
        const isConsecutiveChars = slice.split('').every((c, idx, arr) => {
          if (idx === 0) return true
          return c.charCodeAt(0) === arr[idx - 1].charCodeAt(0) + 1
        })
        const isRepeatedChars = slice.split('').every(c => c === slice[0])
        if (isConsecutiveChars || isRepeatedChars) return false
      }
      return true
    },
    'Password contains too many consecutive or repeated characters'
  )

export interface PasswordValidationResult {
  isValid: boolean
  errors: string[]
  strength: 'weak' | 'fair' | 'good' | 'strong'
  suggestions: string[]
}

/**
 * Validate password against security policy
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = []
  const suggestions: string[] = []

  // Check minimum length
  if (password.length < PASSWORD_CONFIG.minLength) {
    errors.push(`Password must be at least ${PASSWORD_CONFIG.minLength} characters`)
  }

  // Check maximum length
  if (password.length > PASSWORD_CONFIG.maxLength) {
    errors.push(`Password must not exceed ${PASSWORD_CONFIG.maxLength} characters`)
  }

  // Check complexity requirements
  if (PASSWORD_CONFIG.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
    suggestions.push('Add uppercase letters like A, B, C')
  }

  if (PASSWORD_CONFIG.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (PASSWORD_CONFIG.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
    suggestions.push('Add numbers like 0-9')
  }

  if (PASSWORD_CONFIG.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character')
    suggestions.push('Add special characters like !@#$%')
  }

  // Check common passwords
  if (PASSWORD_CONFIG.commonPasswords.has(password.toLowerCase())) {
    errors.push('This password is too common and easily guessed')
    suggestions.push('Use a unique password not found in common password lists')
  }

  // Check for repeated characters
  const repeatedCharPattern = /(.)\1{3,}/
  if (repeatedCharPattern.test(password)) {
    errors.push('Password contains too many repeated characters')
  }

  // Calculate strength
  const strength = calculatePasswordStrength(password, errors.length)

  return {
    isValid: errors.length === 0,
    errors,
    strength,
    suggestions
  }
}

function calculatePasswordStrength(password: string, errorCount: number): 'weak' | 'fair' | 'good' | 'strong' {
  if (errorCount > 0) return 'weak'

  let score = 0
  if (password.length >= 16) score += 2
  else if (password.length >= 12) score += 1

  if (/[A-Z].*[A-Z]/.test(password)) score += 1 // Multiple uppercase
  if (/[a-z].*[a-z]/.test(password)) score += 1 // Multiple lowercase
  if (/[0-9].*[0-9]/.test(password)) score += 1 // Multiple numbers
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?].*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 2 // Multiple special chars

  if (score >= 6) return 'strong'
  if (score >= 4) return 'good'
  if (score >= 2) return 'fair'
  return 'weak'
}

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  // Validate before hashing
  const validation = validatePassword(password)
  if (!validation.isValid) {
    throw new Error(`Invalid password: ${validation.errors.join(', ')}`)
  }

  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Check if password needs rehashing (for security upgrades)
 */
export async function needsRehash(hash: string): Promise<boolean> {
  const currentRounds = 12
  return bcrypt.getRounds(hash) < currentRounds
}
