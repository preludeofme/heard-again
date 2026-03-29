import pino from 'pino'

const isDevelopment = process.env.NODE_ENV === 'development'

const sensitiveFields = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'email',
  'originalName',
  'storagePath',
  'filepath',
  'filePath',
  'apiKey',
  'privateKey',
  'creditCard',
  'ssn',
  'phoneNumber',
  'address',
  'firstName',
  'lastName',
  'fullName',
]

const redactionPaths = sensitiveFields.map(f => `*.${f}`)

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  redact: {
    paths: redactionPaths,
    remove: !isDevelopment, // Remove in production, replace with [Redacted] in dev
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'heardagain-api',
    version: process.env.APP_VERSION || 'unknown',
  },
})

// Security event logging helper
export function logSecurityEvent(
  eventType: string,
  details: Record<string, unknown>
) {
  logger.warn({ eventType, ...details }, 'Security event detected')
}

// Audit logging helper (for compliance)
export function logAuditEvent(
  action: string,
  workspaceId: string,
  userId: string,
  resourceType: string,
  resourceId: string,
  success: boolean,
  details?: Record<string, unknown>
) {
  logger.info({
    audit: true,
    action,
    workspaceId,
    userId,
    resourceType,
    resourceId,
    success,
    timestamp: new Date().toISOString(),
    ...details,
  })
}
