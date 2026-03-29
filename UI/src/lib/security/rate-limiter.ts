import rateLimit from 'express-rate-limit'
import { NextApiRequest, NextApiResponse } from 'next'
import { rateLimitCheck } from '@/lib/redis-client'
import { logger } from '@/lib/logger'

// Rate limiting configurations for different endpoint types
const rateLimitConfigs = {
  // Strict rate limiting for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per window
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Moderate rate limiting for file uploads
  upload: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 uploads per window
    message: 'Too many upload attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Lenient rate limiting for general API endpoints
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per window
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Strict rate limiting for TTS endpoints (resource intensive)
  tts: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 TTS requests per window
    message: 'Too many TTS requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  }
}

// Create rate limiters for each configuration
const rateLimiters = {
  auth: rateLimit(rateLimitConfigs.auth),
  upload: rateLimit(rateLimitConfigs.upload),
  general: rateLimit(rateLimitConfigs.general),
  tts: rateLimit(rateLimitConfigs.tts),
}

// Rate limiting middleware for Next.js API routes
export function withRateLimit(
  type: keyof typeof rateLimitConfigs,
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
): (req: NextApiRequest, res: NextApiResponse) => Promise<void> {
  return async function wrappedHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    const config = {
      max: rateLimitConfigs[type].max,
      windowMs: rateLimitConfigs[type].windowMs,
    }
    const clientIp = getClientIp(req)
    const key = `ratelimit:${type}:${clientIp}`
    
    const { allowed, remaining, resetAt } = await rateLimitCheck(
      key,
      config.max,
      config.windowMs
    )
    
    res.setHeader('X-RateLimit-Limit', config.max)
    res.setHeader('X-RateLimit-Remaining', remaining)
    res.setHeader('X-RateLimit-Reset', resetAt.toISOString())
    
    if (!allowed) {
      logger.warn({
        type: 'RATE_LIMIT_EXCEEDED',
        ip: clientIp,
        endpoint: req.url,
        method: req.method,
        rateLimitType: type,
      }, 'Rate limit exceeded')
      
      res.status(429).json({
        error: 'Too many requests, please try again later',
        retryAfter: Math.ceil(config.windowMs / 1000),
      })
      return
    }
    
    // Apply rate limiting
    await new Promise<void>((resolve, reject) => {
      const limiter = rateLimiters[type]
      
      // Mock express request/response for rate limiter
      const expressReq = {
        ip: req.headers['x-forwarded-for'] as string || 
            req.headers['x-real-ip'] as string || 
            req.connection.remoteAddress || 
            'unknown',
        method: req.method,
        url: req.url,
        headers: req.headers,
      }
      
      const expressRes = {
        status: (code: number) => {
          res.status(code)
          return expressRes
        },
        json: (data: any) => {
          res.json(data)
          return expressRes
        },
        set: (header: string, value: string) => {
          res.setHeader(header, value)
          return expressRes
        },
        get: (header: string) => res.getHeader(header),
      }
      
      limiter(expressReq as any, expressRes as any, (err?: any) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    }).catch((err) => {
      // Rate limit exceeded
      logger.warn({
        ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
        url: req.url,
        method: req.method,
        type,
      }, 'Rate limit exceeded')
      return
    })
    
    // Continue to the actual handler
    return handler(req, res)
  }
}

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const realIp = req.headers['x-real-ip']
  
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  
  if (typeof realIp === 'string') {
    return realIp
  }
  
  return req.socket.remoteAddress || 'unknown'
}

// Rate limiting middleware for TTS service
export function createTTSRateLimit(type: keyof typeof rateLimitConfigs) {
  const config = rateLimitConfigs[type]
  
  return async (req: any, res: any, next: any) => {
    const clientIp = req.headers['x-forwarded-for'] || 
                    req.headers['x-real-ip'] || 
                    req.connection.remoteAddress || 
                    'unknown'
    
    const key = `ratelimit:${type}:${clientIp}`
    
    const { allowed, remaining, resetAt } = await rateLimitCheck(
      key,
      config.max,
      config.windowMs
    )
    
    res.setHeader('X-RateLimit-Limit', config.max)
    res.setHeader('X-RateLimit-Remaining', remaining)
    res.setHeader('X-RateLimit-Reset', resetAt.toISOString())
    
    if (!allowed) {
      return res.status(429).json({
        error: config.message,
        retryAfter: Math.ceil(config.windowMs / 1000)
      })
    }
    
    next()
  }
}

// Rate limiting by user ID (for authenticated endpoints)
export function createUserRateLimit(
  maxRequests: number,
  windowMs: number = 15 * 60 * 1000
) {
  return async (req: any, res: any, next: any) => {
    // Get user ID from auth data if available
    const userId = req.auth_data?.user_id || req.user?.id
    
    if (!userId) {
      // Fall back to IP-based rate limiting
      return createTTSRateLimit('general')(req, res, next)
    }
    
    const key = `ratelimit:user:${userId}`
    
    const { allowed, remaining, resetAt } = await rateLimitCheck(
      key,
      maxRequests,
      windowMs
    )
    
    res.setHeader('X-RateLimit-Limit', maxRequests)
    res.setHeader('X-RateLimit-Remaining', remaining)
    res.setHeader('X-RateLimit-Reset', resetAt.toISOString())
    
    if (!allowed) {
      return res.status(429).json({
        error: 'Too many requests for this user, please try again later',
        retryAfter: Math.ceil(windowMs / 1000),
      })
    }
    
    next()
  }
}

export { rateLimitConfigs, rateLimiters }
