import Redis from 'ioredis'

const REDIS_URL = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379'

export const redis = new Redis(REDIS_URL, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
  maxRetriesPerRequest: null,
})

export async function rateLimitCheck(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
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
    // Rollback the request we just added
    await redis.zremrangebyrank(key, -1, -1)
  }
  
  return { allowed, remaining, resetAt }
}

export async function closeRedisConnection(): Promise<void> {
  await redis.quit()
}
