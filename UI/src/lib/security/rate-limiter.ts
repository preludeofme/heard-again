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
  },

  // Moderate rate limiting for file uploads
  upload: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 uploads per window
    message: 'Too many upload attempts, please try again later',
  },

  // Lenient rate limiting for general API endpoints
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per window
    message: 'Too many requests, please try again later',
  },

  // Strict rate limiting for TTS endpoints (resource intensive)
  tts: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 TTS requests per window
    message: 'Too many TTS requests, please try again later',
  },
}

// Rate limiting middleware for Next.js API routes — Redis sliding-window only
export function withRateLimit(
  type: keyof typeof rateLimitConfigs,
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
): (req: NextApiRequest, res: NextApiResponse) => Promise<void> {
  return async function wrappedHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    const config = rateLimitConfigs[type]
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
        error: config.message,
        retryAfter: Math.ceil(config.windowMs / 1000),
      })
      return
    }

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

  return req.socket?.remoteAddress || 'unknown'
}

// Rate limiting middleware for TTS service (Express-style middleware)
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
        retryAfter: Math.ceil(config.windowMs / 1000),
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
    const userId = req.auth_data?.user_id || req.user?.id

    if (!userId) {
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

export { rateLimitConfigs }
