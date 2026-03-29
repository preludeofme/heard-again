import { NextApiRequest, NextApiResponse } from 'next'
import { healthCheckService } from '@/utils/health'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const health = await healthCheckService.checkSystemHealth()
    
    const statusCode = health.overall === 'healthy' ? 200 : 
                      health.overall === 'degraded' ? 200 : 503

    res.status(statusCode).json(health)
  } catch (error) {
    console.error('Health check error:', error)
    res.status(500).json({
      overall: 'unhealthy',
      services: [],
      uptime: 0,
      version: process.env.APP_VERSION || '1.0.0',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
