// ============================================
// Validation Helpers
// ============================================

export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

export function validate(
  data: Record<string, any>,
  rules: Record<string, ValidationRule[]>
): ValidationResult {
  const errors: Record<string, string> = {}

  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = data[field]
    for (const rule of fieldRules) {
      const error = rule(value, field)
      if (error) {
        errors[field] = error
        break // Stop at first error for this field
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

// ============================================
// Validation Rule Factories
// ============================================

type ValidationRule = (value: any, field: string) => string | null

export const rules = {
  required: (value: any, field: string) =>
    value === undefined || value === null || value === ''
      ? `${field} is required`
      : null,

  string: (value: any, field: string) =>
    value !== undefined && value !== null && typeof value !== 'string'
      ? `${field} must be a string`
      : null,

  email: (value: any, field: string) => {
    if (!value) return null
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return !emailRegex.test(value) ? `${field} must be a valid email` : null
  },

  minLength: (min: number): ValidationRule => (value: any, field: string) => {
    if (!value) return null
    return typeof value === 'string' && value.length < min
      ? `${field} must be at least ${min} characters`
      : null
  },

  maxLength: (max: number): ValidationRule => (value: any, field: string) => {
    if (!value) return null
    return typeof value === 'string' && value.length > max
      ? `${field} must be at most ${max} characters`
      : null
  },

  uuid: (value: any, field: string) => {
    if (!value) return null
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return !uuidRegex.test(value) ? `${field} must be a valid UUID` : null
  },

  oneOf: (options: string[]): ValidationRule => (value: any, field: string) => {
    if (!value) return null
    return !options.includes(value)
      ? `${field} must be one of: ${options.join(', ')}`
      : null
  },

  number: (value: any, field: string) =>
    value !== undefined && value !== null && typeof value !== 'number'
      ? `${field} must be a number`
      : null,

  boolean: (value: any, field: string) =>
    value !== undefined && value !== null && typeof value !== 'boolean'
      ? `${field} must be a boolean`
      : null,

  date: (value: any, field: string) => {
    if (!value) return null
    const d = new Date(value)
    return isNaN(d.getTime()) ? `${field} must be a valid date` : null
  },
}
