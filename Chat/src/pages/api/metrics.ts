import { NextApiRequest, NextApiResponse } from 'next'
import { verifyServiceToken } from '@/utils/auth-guard'
import { runtimeSafetyMetricsCollector } from '@/services/monitoring/RuntimeSafetyMetrics'

function parseThreshold(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!verifyServiceToken(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const safetySnapshot = runtimeSafetyMetricsCollector.getSnapshot()
    const alertThresholds = {
      refusalRate: parseThreshold(process.env.ALERT_MAX_REFUSAL_RATE, 0.7),
      violationRate: parseThreshold(process.env.ALERT_MAX_VIOLATION_RATE, 0.1),
      retrievalEmptyRate: parseThreshold(process.env.ALERT_MAX_RETRIEVAL_EMPTY_RATE, 0.2),
      citationMissingRate: parseThreshold(process.env.ALERT_MAX_CITATION_MISSING_RATE, 0.05),
    }

    const safetyAlerts = {
      refusalRateDrift: safetySnapshot.refusalRate > alertThresholds.refusalRate,
      violationRateDrift: safetySnapshot.violationRate > alertThresholds.violationRate,
      retrievalEmptyRateDrift:
        safetySnapshot.retrievalEmptyRate > alertThresholds.retrievalEmptyRate,
      citationMissingRateDrift:
        safetySnapshot.citationMissingRate > alertThresholds.citationMissingRate,
    }

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

      // Step 9 safety dashboard metrics
      safety: {
        rates: {
          refusalRate: safetySnapshot.refusalRate,
          violationRate: safetySnapshot.violationRate,
          retrievalEmptyRate: safetySnapshot.retrievalEmptyRate,
          citationMissingRate: safetySnapshot.citationMissingRate,
        },
        counts: {
          totalResponses: safetySnapshot.totalResponses,
          refusalResponses: safetySnapshot.refusalResponses,
          violationResponses: safetySnapshot.violationResponses,
          retrievalEmptyResponses: safetySnapshot.retrievalEmptyResponses,
          citationMissingResponses: safetySnapshot.citationMissingResponses,
        },
        alerts: safetyAlerts,
        thresholds: alertThresholds,
        lastUpdatedAt: safetySnapshot.lastUpdatedAt,
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
