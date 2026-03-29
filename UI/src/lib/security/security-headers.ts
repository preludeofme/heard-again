import { NextApiRequest, NextApiResponse } from 'next'
import { generateCspPolicy, generateNonce } from './csp-nonce'

interface SecurityHeadersConfig {
  contentSecurityPolicy?: {
    directives?: Record<string, string[]>
    reportOnly?: boolean
  }
  strictTransportSecurity?: {
    maxAge?: number
    includeSubDomains?: boolean
    preload?: boolean
  }
  xContentTypeOptions?: boolean
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM'
  xXSSProtection?: boolean
  referrerPolicy?: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url'
  permissionsPolicy?: Record<string, boolean>
}

function addCSPHeaders(res: NextApiResponse, config?: SecurityHeadersConfig): void {
  const nonce = generateNonce()
  res.setHeader('X-Content-Security-Policy-Nonce', nonce)
  
  if (config?.contentSecurityPolicy) {
    const directives = config.contentSecurityPolicy.directives || {}
    const cspDirectives = Object.entries(directives)
      .map(([directive, values]) => `${directive} ${values.join(' ')}`)
      .join('; ')
    
    const headerName = config.contentSecurityPolicy.reportOnly 
      ? 'Content-Security-Policy-Report-Only' 
      : 'Content-Security-Policy'
    
    res.setHeader(headerName, cspDirectives)
  } else {
    res.setHeader('Content-Security-Policy', generateCspPolicy(nonce))
  }
}

function addSTSHeaders(req: NextApiRequest, res: NextApiResponse, config?: SecurityHeadersConfig): void {
  if (config?.strictTransportSecurity && req.headers['x-forwarded-proto'] === 'https') {
    const sts = config.strictTransportSecurity
    const stsDirectives = [
      `max-age=${sts.maxAge || 31536000}`,
      sts.includeSubDomains ? 'includeSubDomains' : '',
      sts.preload ? 'preload' : '',
    ].filter(Boolean).join('; ')
    
    res.setHeader('Strict-Transport-Security', stsDirectives)
  }
}

function addStandardSecurityHeaders(res: NextApiResponse, config?: SecurityHeadersConfig): void {
  // X-Content-Type-Options
  if (config?.xContentTypeOptions !== false) {
    res.setHeader('X-Content-Type-Options', 'nosniff')
  }

  // X-Frame-Options
  if (config?.xFrameOptions) {
    res.setHeader('X-Frame-Options', config.xFrameOptions)
  } else {
    res.setHeader('X-Frame-Options', 'DENY')
  }

  // X-XSS-Protection
  if (config?.xXSSProtection !== false) {
    res.setHeader('X-XSS-Protection', '1; mode=block')
  }

  // Referrer Policy
  if (config?.referrerPolicy) {
    res.setHeader('Referrer-Policy', config.referrerPolicy)
  } else {
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  }
}

function addPermissionsPolicyHeaders(res: NextApiResponse, config?: SecurityHeadersConfig): void {
  const defaultPermissions = {
    'geolocation': false,
    'microphone': false,
    'camera': false,
    'payment': false,
    'usb': false,
    'magnetometer': false,
    'gyroscope': false,
    'accelerometer': false,
    'ambient-light-sensor': false,
    'autoplay': false,
    'encrypted-media': false,
    'fullscreen': false,
    'picture-in-picture': false,
  }
  
  const permissions = config?.permissionsPolicy || defaultPermissions
  const disabledFeatures = Object.entries(permissions)
    .filter(([_, enabled]) => !enabled)
    .map(([feature]) => feature)
    .join(', ')
  
  if (disabledFeatures) {
    res.setHeader('Permissions-Policy', disabledFeatures)
  }
}

function addAdditionalSecurityHeaders(res: NextApiResponse): void {
  res.setHeader('X-DNS-Prefetch-Control', 'off')
  res.setHeader('X-Download-Options', 'noopen')
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none')
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
}

export function addSecurityHeaders(
  req: NextApiRequest,
  res: NextApiResponse,
  config?: SecurityHeadersConfig
): void {
  addCSPHeaders(res, config)
  addSTSHeaders(req, res, config)
  addStandardSecurityHeaders(res, config)
  addPermissionsPolicyHeaders(res, config)
  addAdditionalSecurityHeaders(res)
}

// Middleware wrapper for Next.js API routes
export function withSecurityHeaders(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  config?: SecurityHeadersConfig
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Add security headers before processing the request
    addSecurityHeaders(req, res, config)
    
    // Continue to the actual handler
    return handler(req, res)
  }
}

// Development-friendly configuration (less strict for local development)
export const developmentSecurityConfig: SecurityHeadersConfig = {
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'localhost:3002'], // Development needs
      'style-src': ["'self'", "'unsafe-inline'", 'localhost:3002'],
      'img-src': ["'self'", 'data:', 'https:', 'localhost:3002'],
      'font-src': ["'self'", 'data:', 'localhost:3002'],
      'connect-src': ["'self'", 'https://localhost:3002', 'https://localhost:8100', 'ws://localhost:3002', 'ws://localhost:8100'],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
    },
    reportOnly: false,
  },
  strictTransportSecurity: undefined, // Skip HSTS in development
  xContentTypeOptions: true,
  xFrameOptions: 'DENY',
  xXSSProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    'geolocation': false,
    'microphone': false,
    'camera': false,
    'payment': false,
    'usb': false,
    'magnetometer': false,
    'gyroscope': false,
    'accelerometer': false,
    'ambient-light-sensor': false,
    'autoplay': false,
    'encrypted-media': false,
    'fullscreen': false,
    'picture-in-picture': false,
  },
}

// Production-ready configuration (more strict)
export const productionSecurityConfig: SecurityHeadersConfig = {
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"], // No unsafe-inline/eval in production
      'style-src': ["'self'"], // No unsafe-inline in production
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'"], // Only same-origin in production
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
    },
    reportOnly: false,
  },
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  xContentTypeOptions: true,
  xFrameOptions: 'DENY',
  xXSSProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    'geolocation': false,
    'microphone': false,
    'camera': false,
    'payment': false,
    'usb': false,
    'magnetometer': false,
    'gyroscope': false,
    'accelerometer': false,
    'ambient-light-sensor': false,
    'autoplay': false,
    'encrypted-media': false,
    'fullscreen': false,
    'picture-in-picture': false,
  },
}

// Get appropriate config based on environment
export function getSecurityConfig(): SecurityHeadersConfig {
  const isDevelopment = process.env.NODE_ENV === 'development'
  return isDevelopment ? developmentSecurityConfig : productionSecurityConfig
}

// CSP violation reporter (for monitoring)
export function reportCSPViolation(
  req: NextApiRequest,
  res: NextApiResponse
): void {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const violation = req.body
    
    // Log CSP violations for security monitoring
    console.error('CSP Violation:', {
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress,
      timestamp: new Date().toISOString(),
      violatedDirective: violation['violated-directive'],
      blockedURI: violation['blocked-uri'],
      documentURI: violation['document-uri'],
      referrer: violation['referrer'],
    })

    // In production, you'd send this to a security monitoring service
    // For now, just log it

    res.status(204).end()
  } catch (error) {
    console.error('Error processing CSP violation report:', error)
    res.status(400).json({ error: 'Invalid report' })
  }
}
