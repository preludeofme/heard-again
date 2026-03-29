import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      
      // Memory metrics
      memory: {
        rss: process.memoryUsage().rss,
        heapTotal: process.memoryUsage().heapTotal,
        heapUsed: process.memoryUsage().heapUsed,
        external: process.memoryUsage().external,
        arrayBuffers: process.memoryUsage().arrayBuffers,
      },
      
      // CPU metrics (basic)
      cpu: {
        usage: process.cpuUsage(),
      },
      
      // Event loop metrics
      eventLoop: {
        loopUtilization: (process as any).eventLoopUtilization?.() || null,
      },
      
      // Application metrics
      application: {
        activeConnections: 0, // Would be tracked in real implementation
        totalRequests: 0, // Would be tracked in real implementation
        averageResponseTime: 0, // Would be tracked in real implementation
      },
      
      // System info
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
      }
    }

    // Set cache headers for monitoring systems
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Content-Type', 'application/json')
    
    res.status(200).json(metrics)
  } catch (error) {
    console.error('Metrics endpoint error:', error)
    res.status(500).json({ 
      error: 'Failed to collect metrics',
      timestamp: new Date().toISOString()
    })
  }
}
