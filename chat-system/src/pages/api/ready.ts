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
    const { ready, checks } = await healthCheckService.getReadiness()
    
    const statusCode = ready ? 200 : 503

    res.status(statusCode).json({
      ready,
      checks,
      timestamp: new Date()
    })
  } catch (error) {
    console.error('Readiness check error:', error)
    res.status(503).json({
      ready: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    })
  }
}
