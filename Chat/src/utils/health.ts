import { Database } from './database'
import { queueManager, queueHealthMonitor } from './queues'

export interface HealthCheckResult {
  service: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  message: string
  responseTime?: number
  details?: any
  timestamp: Date
}

export interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded'
  services: HealthCheckResult[]
  uptime: number
  version: string
  timestamp: Date
}

export class HealthCheckService {
  private startTime: Date = new Date()
  private version: string = process.env.APP_VERSION || '1.0.0'

  async checkSystemHealth(): Promise<SystemHealth> {
    const services = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkOllama(),
      this.checkChromaDB(),
      this.checkQueues(),
      this.checkDiskSpace(),
      this.checkMemory(),
    ])

    const results = services
      .filter((result): result is PromiseFulfilledResult<HealthCheckResult> => result.status === 'fulfilled')
      .map(result => result.value)

    const overall = this.calculateOverallHealth(results)

    return {
      overall,
      services: results,
      uptime: Date.now() - this.startTime.getTime(),
      version: this.version,
      timestamp: new Date(),
    }
  }

  async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const isHealthy = await Database.healthCheck()
      const responseTime = Date.now() - startTime

      return {
        service: 'database',
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy ? 'Database connection successful' : 'Database connection failed',
        responseTime,
        timestamp: new Date(),
      }
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      }
    }
  }

  async checkRedis(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const redis = require('ioredis')
      const client = new redis.default({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      })

      await client.ping()
      await client.quit()
      
      const responseTime = Date.now() - startTime

      return {
        service: 'redis',
        status: 'healthy',
        message: 'Redis connection successful',
        responseTime,
        timestamp: new Date(),
      }
    } catch (error) {
      return {
        service: 'redis',
        status: 'unhealthy',
        message: `Redis error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      }
    }
  }

  async checkOllama(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const axios = require('axios')
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
      
      const response = await axios.get(`${ollamaUrl}/api/tags`, {
        timeout: 5000,
      })

      const models = response.data.models || []
      const hasRequiredModels = models.some((m: any) => 
        m.name.includes('llama3.1') || m.name.includes('qwen2.5')
      ) && models.some((m: any) => m.name.includes('nomic-embed'))

      const responseTime = Date.now() - startTime

      return {
        service: 'ollama',
        status: hasRequiredModels ? 'healthy' : 'degraded',
        message: `Ollama running with ${models.length} models loaded`,
        responseTime,
        details: {
          models: models.map((m: any) => m.name),
          modelCount: models.length,
          hasRequiredModels,
        },
        timestamp: new Date(),
      }
    } catch (error) {
      return {
        service: 'ollama',
        status: 'unhealthy',
        message: `Ollama error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      }
    }
  }

  async checkChromaDB(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const axios = require('axios')
      const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8004'
      
      const response = await axios.get(`${chromaUrl}/api/v2/heartbeat`, {
        timeout: 5000,
      })

      const responseTime = Date.now() - startTime

      return {
        service: 'chromadb',
        status: 'healthy',
        message: 'ChromaDB connection successful',
        responseTime,
        details: {
          heartbeat: response.data,
        },
        timestamp: new Date(),
      }
    } catch (error) {
      return {
        service: 'chromadb',
        status: 'unhealthy',
        message: `ChromaDB error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      }
    }
  }

  async checkQueues(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const queueNames = ['document-ingestion', 'embedding-generation', 'persona-generation']
      const queueStats = await Promise.allSettled(
        queueNames.map(name => queueManager.getQueueStats(name))
      )

      const stats = queueStats
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value)

      const totalJobs = stats.reduce((sum, stat) => 
        sum + stat.waiting + stat.active + stat.failed, 0
      )

      const hasFailedJobs = stats.some(stat => stat.failed > 0)
      const isBackedUp = stats.some(stat => stat.waiting > 50)

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
      if (hasFailedJobs) status = 'degraded'
      if (isBackedUp) status = 'degraded'

      const responseTime = Date.now() - startTime

      return {
        service: 'queues',
        status,
        message: `Queue system operational with ${totalJobs} total jobs`,
        responseTime,
        details: {
          queueStats: stats.reduce((acc, stat, index) => ({
            ...acc,
            [queueNames[index]]: stat,
          }), {}),
          totalJobs,
          hasFailedJobs,
          isBackedUp,
        },
        timestamp: new Date(),
      }
    } catch (error) {
      return {
        service: 'queues',
        status: 'unhealthy',
        message: `Queue error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      }
    }
  }

  async checkDiskSpace(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const fs = require('fs')
      const path = require('path')
      
      const uploadDir = process.env.UPLOAD_DIR || './uploads'
      const stats = fs.statSync(uploadDir)
      
      // Simple check - in production you'd want more sophisticated disk space monitoring
      const responseTime = Date.now() - startTime

      return {
        service: 'disk-space',
        status: 'healthy',
        message: 'Upload directory accessible',
        responseTime,
        details: {
          uploadDir,
          accessible: true,
        },
        timestamp: new Date(),
      }
    } catch (error) {
      return {
        service: 'disk-space',
        status: 'unhealthy',
        message: `Disk space error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      }
    }
  }

  async checkMemory(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const memoryUsage = process.memoryUsage()
      const totalMemory = memoryUsage.heapTotal
      const usedMemory = memoryUsage.heapUsed
      const memoryUsagePercent = (usedMemory / totalMemory) * 100

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
      if (memoryUsagePercent > 90) status = 'unhealthy'
      else if (memoryUsagePercent > 75) status = 'degraded'

      const responseTime = Date.now() - startTime

      return {
        service: 'memory',
        status,
        message: `Memory usage at ${memoryUsagePercent.toFixed(1)}%`,
        responseTime,
        details: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
          usagePercent: memoryUsagePercent,
        },
        timestamp: new Date(),
      }
    } catch (error) {
      return {
        service: 'memory',
        status: 'unhealthy',
        message: `Memory check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      }
    }
  }

  private calculateOverallHealth(results: HealthCheckResult[]): 'healthy' | 'unhealthy' | 'degraded' {
    if (results.length === 0) return 'unhealthy'

    const unhealthyCount = results.filter(r => r.status === 'unhealthy').length
    const degradedCount = results.filter(r => r.status === 'degraded').length

    if (unhealthyCount > 0) return 'unhealthy'
    if (degradedCount > 0) return 'degraded'
    return 'healthy'
  }

  // Start continuous health monitoring
  startMonitoring(intervalMs = 60000): void {
    setInterval(async () => {
      try {
        const health = await this.checkSystemHealth()
        
        // Log health status
        console.log(`System health: ${health.overall}`, {
          services: health.services.map(s => `${s.service}:${s.status}`).join(', '),
          uptime: `${Math.round(health.uptime / 1000)}s`,
        })

        // Start queue health monitoring
        queueHealthMonitor.startHealthCheck('document-ingestion')
        queueHealthMonitor.startHealthCheck('embedding-generation')
        queueHealthMonitor.startHealthCheck('persona-generation')
      } catch (error) {
        console.error('Health monitoring error:', error)
      }
    }, intervalMs)
  }

  // Get readiness check (for Kubernetes/liveness probes)
  async getReadiness(): Promise<{ ready: boolean; checks: HealthCheckResult[] }> {
    const criticalServices = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
    ])

    const results = criticalServices
      .filter((result): result is PromiseFulfilledResult<HealthCheckResult> => result.status === 'fulfilled')
      .map(result => result.value)

    const ready = results.every(r => r.status === 'healthy')

    return { ready, checks: results }
  }

  // Get liveness check (lighter weight)
  async getLiveness(): Promise<{ alive: boolean }> {
    try {
      // Just check if the process is responsive
      const memoryUsage = process.memoryUsage()
      const alive = memoryUsage.heapUsed > 0

      return { alive }
    } catch (error) {
      return { alive: false }
    }
  }
}

export const healthCheckService = new HealthCheckService()
