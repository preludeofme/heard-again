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
    const { alive } = await healthCheckService.getLiveness()
    
    const statusCode = alive ? 200 : 503

    res.status(statusCode).json({
      alive,
      timestamp: new Date()
    })
  } catch (error) {
    console.error('Liveness check error:', error)
    res.status(503).json({
      alive: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    })
  }
}
