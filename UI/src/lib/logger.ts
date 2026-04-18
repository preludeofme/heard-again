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

const _pinoLogger = pino({
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

/**
 * Thin wrapper around pino that accepts console-style (msg, extra?) call
 * signatures, for easy migration from console.*.
 */
/**
 * Wrapper accepting both:
 *   - console-style:  logger.error('msg', someValue?)
 *   - pino-style:     logger.error({ obj }, 'msg')
 */
function makeLogMethod(pinoMethod: (...args: any[]) => void) {
  return (msgOrObj: string | object, msgOrExtra?: unknown): void => {
    if (typeof msgOrObj === 'string') {
      // Console-style: (msg, extra?)
      if (msgOrExtra === undefined) {
        pinoMethod(msgOrObj)
      } else if (msgOrExtra !== null && typeof msgOrExtra === 'object') {
        pinoMethod(msgOrExtra, msgOrObj)
      } else {
        pinoMethod({ value: msgOrExtra }, msgOrObj)
      }
    } else {
      // Pino-style: (obj, msg?)
      pinoMethod(msgOrObj, msgOrExtra ?? '')
    }
  }
}

export const logger = {
  error: makeLogMethod(_pinoLogger.error.bind(_pinoLogger) as any),
  warn:  makeLogMethod(_pinoLogger.warn.bind(_pinoLogger) as any),
  info:  makeLogMethod(_pinoLogger.info.bind(_pinoLogger) as any),
  debug: makeLogMethod(_pinoLogger.debug.bind(_pinoLogger) as any),
  child: (bindings: object) => _pinoLogger.child(bindings),
}

// Security event logging helper
export function logSecurityEvent(
  eventType: string,
  details: Record<string, unknown>
) {
  _pinoLogger.warn({ eventType, ...details }, 'Security event detected')
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
  _pinoLogger.info({
    audit: true,
    action,
    workspaceId,
    userId,
    resourceType,
    resourceId,
    success,
    timestamp: new Date().toISOString(),
    ...details,
  }, 'Audit event')
}
