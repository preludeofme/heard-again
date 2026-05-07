import Redis from 'ioredis'

export function createRedis(): Redis {
  const url = process.env.REDIS_URL
  if (url) {
    return new Redis(url, { maxRetriesPerRequest: null, lazyConnect: true })
  }
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
    lazyConnect: true,
  })
}
