import Redis from 'ioredis'

const REDIS_URL = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL

let redisInstance: Redis | null = null

export function getRedisConnection(): Redis | null {
  if (!REDIS_URL) return null

  if (!redisInstance) {
    redisInstance = new Redis(REDIS_URL, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      maxRetriesPerRequest: null,
    })
  }
  return redisInstance
}

export async function rateLimitCheck(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const redis = getRedisConnection()

  if (!redis) {
    return { allowed: true, remaining: maxRequests, resetAt: new Date(Date.now() + windowMs) }
  }

  const now = Date.now()
  const windowStart = now - windowMs

  const multi = redis.multi()
  multi.zremrangebyscore(key, 0, windowStart)
  multi.zcard(key)
  multi.zadd(key, now, `${now}-${Math.random()}`)
  multi.pexpire(key, windowMs)

  const results = await multi.exec()
  const currentCount = (results?.[1]?.[1] as number) || 0

  const allowed = currentCount < maxRequests
  const remaining = Math.max(0, maxRequests - currentCount - 1)
  const resetAt = new Date(now + windowMs)

  if (!allowed) {
    await redis.zremrangebyrank(key, -1, -1)
  }

  return { allowed, remaining, resetAt }
}

export async function closeRedisConnection(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit()
    redisInstance = null
  }
}
