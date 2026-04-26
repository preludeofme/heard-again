import { logger } from '@/lib/logger'
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { randomBytes, createHash, randomUUID } from 'crypto'

// Extend Next.js types to include security context
declare global {
  namespace NextApi {
    interface Request {
      requestId?: string
      securityContext?: {
        ipAddress: string
        userAgent: string
        timestamp: Date
        requestId: string
      }
      sessionId?: string
    }
  }
}

export interface SecurityEvent {
  type: 'AUTH_SUCCESS' | 'AUTH_FAILURE' | 'TENANT_VIOLATION' | 'MALWARE_DETECTED' | 
        'FILE_UPLOAD' | 'FILE_ACCESS' | 'RATE_LIMIT_EXCEEDED' | 'SUSPICIOUS_ACTIVITY' |
        'SECURITY_CONFIG_CHANGE' | 'DATA_EXPORT' | 'VOICE_PROFILE_ACCESS' | 'SYSTEM_ERROR'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  userId?: string
  workspaceId?: string
  ipAddress?: string
  userAgent?: string
  resource?: string
  action?: string
  details?: Record<string, any>
  timestamp: Date
  sessionId?: string
  requestId?: string
}

export interface AuditTrail {
  id: string
  eventType: string
  userId: string
  workspaceId: string
  action: string
  resourceType: string
  resourceId: string
  oldValue?: any
  newValue?: any
  ipAddress: string
  userAgent: string
  timestamp: Date
  metadata?: Record<string, any>
}

class SecurityLogger {
  private static instance: SecurityLogger
  private logBuffer: SecurityEvent[] = []
  private flushInterval: NodeJS.Timeout | null = null
  private readonly bufferSize = 100
  private readonly flushDelay = 5000 // 5 seconds

  private constructor() {
    this.startFlushTimer()
  }

  static getInstance(): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger()
    }
    return SecurityLogger.instance
  }

  private startFlushTimer() {
    this.flushInterval = setInterval(() => {
      this.flushLogs()
    }, this.flushDelay)
  }

  async logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
      requestId: this.generateRequestId(),
    }

    // Add to buffer
    this.logBuffer.push(securityEvent)

    // Immediately flush critical events
    if (event.severity === 'CRITICAL') {
      await this.flushLogs()
    }

    // Flush if buffer is full
    if (this.logBuffer.length >= this.bufferSize) {
      await this.flushLogs()
    }

    // Also log to console for immediate visibility
    this.logToConsole(securityEvent)
  }

  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return

    const eventsToFlush = [...this.logBuffer]
    this.logBuffer = []

    try {
      // In production, send to security monitoring service
      // For now, store in database and log to file
      await this.persistSecurityEvents(eventsToFlush)
    } catch (error) {
      logger.error('Failed to flush security logs:', error)
      // Add events back to buffer for retry
      this.logBuffer.unshift(...eventsToFlush)
    }
  }

  private async persistSecurityEvents(events: SecurityEvent[]): Promise<void> {
    // Store critical security events in database (simplified)
    const criticalEvents = events.filter(e => e.severity === 'CRITICAL')
    
    if (criticalEvents.length > 0) {
      try {
        // For now, just log to console - in production would integrate with audit system
        logger.error('CRITICAL SECURITY EVENTS:', criticalEvents.map(e => ({
          type: e.type,
          userId: e.userId,
          workspaceId: e.workspaceId,
          details: e.details,
          timestamp: e.timestamp
        })))
      } catch (error) {
        logger.error('Failed to persist audit logs:', error)
      }
    }

    // Log all events to secure file (in production, this would be a log aggregation service)
    events.forEach(event => {
      this.logToFile(event)
    })
  }

  private logToConsole(event: SecurityEvent): void {
    const logLevel = this.getLogLevel(event.severity)
    const message = this.formatLogMessage(event)
    
    logger[logLevel](`[SECURITY] ${message}`, {
      type: event.type,
      severity: event.severity,
      userId: event.userId,
      workspaceId: event.workspaceId,
      ipAddress: this.anonymizeIP(event.ipAddress),
      resource: event.resource,
      action: event.action,
      timestamp: event.timestamp.toISOString(),
    })
  }

  private logToFile(event: SecurityEvent): void {
    // In production, this would write to a secure log file or send to a log service
    // For now, we'll just use the structured logger
    const logEntry = {
      timestamp: event.timestamp.toISOString(),
      level: 'SECURITY',
      type: event.type,
      severity: event.severity,
      userId: event.userId,
      workspaceId: event.workspaceId,
      ipAddress: this.anonymizeIP(event.ipAddress),
      userAgent: event.userAgent,
      resource: event.resource,
      action: event.action,
      details: event.details,
      requestId: event.requestId,
      sessionId: event.sessionId,
    }

    logger.info(logEntry)
  }

  private formatLogMessage(event: SecurityEvent): string {
    let message = event.type
    
    if (event.userId) message += ` user:${event.userId}`
    if (event.workspaceId) message += ` workspace:${event.workspaceId}`
    if (event.resource) message += ` resource:${event.resource}`
    if (event.action) message += ` action:${event.action}`
    
    return message
  }

  private getLogLevel(severity: string): 'info' | 'warn' | 'error' {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return 'error'
      case 'MEDIUM':
        return 'warn'
      case 'LOW':
      default:
        return 'info'
    }
  }

  private anonymizeIP(ip?: string): string {
    if (!ip) return 'unknown'
    
    // Anonymize IP by zeroing out the last octet
    const parts = ip.split('.')
    if (parts.length === 4) {
      parts[3] = '0'
      return parts.join('.')
    }
    
    // For IPv6 or other formats, return a hash
    return createHash('sha256').update(ip).digest('hex').substring(0, 8)
  }

  /**
   * Helper to hash sensitive strings like email or filenames for logging
   */
  anonymizeString(value?: string): string {
    if (!value) return 'unknown'
    return createHash('sha256').update(value).digest('hex').substring(0, 12)
  }

  private generateRequestId(): string {
    return randomBytes(16).toString('hex')
  }

  private generateId(): string {
    return randomUUID()
  }

  async cleanup(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    await this.flushLogs()
  }
}

// Middleware to add security context to requests
export function addSecurityContext(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  // Generate unique request ID
  (req as any).requestId = require('crypto').randomBytes(16).toString('hex')
  
  // Extract security-relevant information
  (req as any).securityContext = {
    ipAddress: req.headers['x-forwarded-for'] as string || 
                req.headers['x-real-ip'] as string || 
                req.connection.remoteAddress || 
                'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    timestamp: new Date(),
    requestId: (req as any).requestId,
  }

  next()
}

// Helper functions for common security events
export const securityEvents = {
  async logAuthSuccess(userId: string, workspaceId: string, ipAddress?: string, userAgent?: string) {
    const logger = SecurityLogger.getInstance()
    await logger.logSecurityEvent({
      type: 'AUTH_SUCCESS',
      severity: 'LOW',
      userId,
      workspaceId,
      ipAddress,
      userAgent,
      action: 'LOGIN',
      details: {
        method: 'credentials',
      },
    })
  },

  async logAuthFailure(email: string, reason: string, ipAddress?: string, userAgent?: string) {
    const loggerInstance = SecurityLogger.getInstance()
    await loggerInstance.logSecurityEvent({
      type: 'AUTH_FAILURE',
      severity: 'MEDIUM',
      ipAddress,
      userAgent,
      action: 'LOGIN_ATTEMPT',
      details: {
        emailHash: loggerInstance.anonymizeString(email),
        reason,
      },
    })
  },

  async logTenantViolation(userId: string, workspaceId: string, targetWorkspaceId: string, ipAddress?: string, userAgent?: string) {
    const logger = SecurityLogger.getInstance()
    await logger.logSecurityEvent({
      type: 'TENANT_VIOLATION',
      severity: 'HIGH',
      userId,
      workspaceId,
      ipAddress,
      userAgent,
      action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      details: {
        targetWorkspaceId,
      },
    })
  },

  async logMalwareDetected(userId: string, workspaceId: string, filename: string, threats: string[], ipAddress?: string, userAgent?: string) {
    const loggerInstance = SecurityLogger.getInstance()
    await loggerInstance.logSecurityEvent({
      type: 'MALWARE_DETECTED',
      severity: 'CRITICAL',
      userId,
      workspaceId,
      ipAddress,
      userAgent,
      resource: 'FILE',
      action: 'UPLOAD',
      details: {
        filenameHash: loggerInstance.anonymizeString(filename),
        threats,
      },
    })
  },

  async logFileUpload(userId: string, workspaceId: string, filename: string, fileSize: number, ipAddress?: string, userAgent?: string) {
    const loggerInstance = SecurityLogger.getInstance()
    await loggerInstance.logSecurityEvent({
      type: 'FILE_UPLOAD',
      severity: 'LOW',
      userId,
      workspaceId,
      ipAddress,
      userAgent,
      resource: 'FILE',
      action: 'UPLOAD',
      details: {
        filenameHash: loggerInstance.anonymizeString(filename),
        fileSize,
      },
    })
  },

  async logFileAccess(userId: string, workspaceId: string, resourceId: string, ipAddress?: string, userAgent?: string) {
    const logger = SecurityLogger.getInstance()
    await logger.logSecurityEvent({
      type: 'FILE_ACCESS',
      severity: 'LOW',
      userId,
      workspaceId,
      ipAddress,
      userAgent,
      resource: 'FILE',
      action: 'ACCESS',
      details: {
        resourceId,
      },
    })
  },

  async logRateLimitExceeded(ipAddress: string, endpoint: string, userAgent?: string) {
    const logger = SecurityLogger.getInstance()
    await logger.logSecurityEvent({
      type: 'RATE_LIMIT_EXCEEDED',
      severity: 'MEDIUM',
      ipAddress,
      userAgent,
      resource: 'API_ENDPOINT',
      action: 'RATE_LIMIT',
      details: {
        endpoint,
      },
    })
  },

  async logSuspiciousActivity(userId: string, workspaceId: string, activity: string, details: Record<string, any>, ipAddress?: string, userAgent?: string) {
    const logger = SecurityLogger.getInstance()
    await logger.logSecurityEvent({
      type: 'SUSPICIOUS_ACTIVITY',
      severity: 'HIGH',
      userId,
      workspaceId,
      ipAddress,
      userAgent,
      action: activity,
      details,
    })
  },
}

export default SecurityLogger
