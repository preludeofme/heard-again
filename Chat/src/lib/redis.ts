import Redis from 'ioredis'

/**
 * Create a Redis connection with proper configuration
 */
export function createRedis(): Redis {
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    lazyConnect: true,
  })
}
