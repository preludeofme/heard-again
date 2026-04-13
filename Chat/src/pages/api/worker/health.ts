import { NextApiRequest, NextApiResponse } from 'next'
import { Queue } from 'bullmq'
import { createRedis } from '@/lib/redis'

/**
 * Health check endpoint for the ingestion worker
 * Checks:
 * 1. Worker can connect to Redis
 * 2. Worker queue is accessible
 * 3. Basic worker functionality
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Check Redis connection
    const redis = createRedis()
    await redis.ping()
    
    // Check queue accessibility
    const queue = new Queue('document-ingestion', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        maxRetriesPerRequest: null,
      },
    })
    
    // Get queue stats
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
    ])
    
    await queue.close()
    await redis.disconnect()
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        redis: 'connected',
        queue: 'accessible',
      },
      stats: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      },
    })
  } catch (error) {
    console.error('Worker health check failed:', error)
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
