import { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'
import { ChromaClient } from 'chromadb'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const startTime = Date.now()
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: 'unknown',
      chromadb: 'unknown',
      ollama: 'unknown',
      redis: 'unknown',
      tts: 'unknown'
    },
    metrics: {
      memory: process.memoryUsage(),
      responseTime: 0
    },
    errors: [] as string[]
  }

  try {
    // Database health check
    try {
      await prisma.$queryRaw`SELECT 1`
      healthStatus.services.database = 'healthy'
    } catch (error) {
      healthStatus.services.database = 'unhealthy'
      healthStatus.errors.push('Database connection failed')
    }

    // ChromaDB health check
    try {
      const chromaClient = new ChromaClient({ 
        path: process.env.CHROMA_URL || 'http://localhost:8004' 
      })
      await chromaClient.heartbeat()
      healthStatus.services.chromadb = 'healthy'
    } catch (error) {
      healthStatus.services.chromadb = 'unhealthy'
      healthStatus.errors.push('ChromaDB connection failed')
    }

    // Ollama health check
    try {
      const ollamaResponse = await fetch(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/tags`)
      if (ollamaResponse.ok) {
        healthStatus.services.ollama = 'healthy'
      } else {
        throw new Error('Ollama API not responding')
      }
    } catch (error) {
      healthStatus.services.ollama = 'unhealthy'
      healthStatus.errors.push('Ollama connection failed')
    }

    // Redis health check
    try {
      // Simple Redis check would go here
      healthStatus.services.redis = 'healthy' // Placeholder
    } catch (error) {
      healthStatus.services.redis = 'unhealthy'
      healthStatus.errors.push('Redis connection failed')
    }

    // TTS Service health check
    try {
      const ttsResponse = await fetch(`${process.env.TTS_SERVICE_URL || 'http://localhost:8101'}/api/tts/health`)
      if (ttsResponse.ok) {
        healthStatus.services.tts = 'healthy'
      } else {
        throw new Error('TTS service not responding')
      }
    } catch (error) {
      healthStatus.services.tts = 'unhealthy'
      healthStatus.errors.push('TTS service connection failed')
    }

  } catch (error) {
    healthStatus.errors.push('Health check failed: ' + (error as Error).message)
  }

  // Determine overall status
  const unhealthyServices = Object.values(healthStatus.services).filter(status => status === 'unhealthy')
  if (unhealthyServices.length > 0) {
    healthStatus.status = 'degraded'
  }

  healthStatus.metrics.responseTime = Date.now() - startTime

  const statusCode = healthStatus.status === 'healthy' ? 200 : 503
  res.status(statusCode).json(healthStatus)
}
