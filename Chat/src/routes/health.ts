import type { FastifyInstance } from 'fastify';
import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { ChromaClient } from 'chromadb';
import { healthCheckService } from '@/utils/health';
import { runtimeSafetyMetricsCollector } from '@/services/monitoring/RuntimeSafetyMetrics';
import { createRedis } from '@/lib/redis';
import { bearerAuthHook } from '@/hooks/auth';

const prisma = new PrismaClient();

function parseThreshold(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get('/api/health', async (_req, reply) => {
    try {
      const health = await healthCheckService.checkSystemHealth();
      const statusCode = health.overall === 'unhealthy' ? 503 : 200;
      return reply.code(statusCode).send(health);
    } catch (error) {
      return reply.code(500).send({
        overall: 'unhealthy',
        services: [],
        uptime: 0,
        version: process.env.APP_VERSION || '1.0.0',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.get('/api/health/detailed', async (_req, reply) => {
    const startTime = Date.now();
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: 'unknown' as string,
        chromadb: 'unknown' as string,
        ollama: 'unknown' as string,
        redis: 'unknown' as string,
        tts: 'unknown' as string,
      },
      metrics: {
        memory: process.memoryUsage(),
        responseTime: 0,
      },
      errors: [] as string[],
    };

    try {
      try {
        await prisma.$queryRaw`SELECT 1`;
        healthStatus.services.database = 'healthy';
      } catch {
        healthStatus.services.database = 'unhealthy';
        healthStatus.errors.push('Database connection failed');
      }

      try {
        const chromaClient = new ChromaClient({
          path: process.env.CHROMA_URL || 'http://localhost:8004',
        });
        await chromaClient.heartbeat();
        healthStatus.services.chromadb = 'healthy';
      } catch {
        healthStatus.services.chromadb = 'unhealthy';
        healthStatus.errors.push('ChromaDB connection failed');
      }

      try {
        const ollamaResponse = await fetch(
          `${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/tags`,
        );
        if (ollamaResponse.ok) {
          healthStatus.services.ollama = 'healthy';
        } else {
          throw new Error('Ollama API not responding');
        }
      } catch {
        healthStatus.services.ollama = 'unhealthy';
        healthStatus.errors.push('Ollama connection failed');
      }

      try {
        healthStatus.services.redis = 'healthy';
      } catch {
        healthStatus.services.redis = 'unhealthy';
        healthStatus.errors.push('Redis connection failed');
      }

      try {
        const ttsResponse = await fetch(
          `${process.env.TTS_SERVICE_URL || 'http://localhost:4779'}/api/tts/health`,
        );
        if (ttsResponse.ok) {
          healthStatus.services.tts = 'healthy';
        } else {
          throw new Error('TTS service not responding');
        }
      } catch {
        healthStatus.services.tts = 'unhealthy';
        healthStatus.errors.push('TTS service connection failed');
      }
    } catch (error) {
      healthStatus.errors.push('Health check failed: ' + (error as Error).message);
    }

    const unhealthyServices = Object.values(healthStatus.services).filter(s => s === 'unhealthy');
    if (unhealthyServices.length > 0) {
      healthStatus.status = 'degraded';
    }

    healthStatus.metrics.responseTime = Date.now() - startTime;
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    return reply.code(statusCode).send(healthStatus);
  });

  app.get('/api/ready', async (_req, reply) => {
    try {
      const { ready, checks } = await healthCheckService.getReadiness();
      return reply.code(ready ? 200 : 503).send({ ready, checks, timestamp: new Date() });
    } catch (error) {
      return reply.code(503).send({
        ready: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
    }
  });

  app.get('/api/live', async (_req, reply) => {
    try {
      const { alive } = await healthCheckService.getLiveness();
      return reply.code(alive ? 200 : 503).send({ alive, timestamp: new Date() });
    } catch (error) {
      return reply.code(503).send({
        alive: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
    }
  });

  app.get('/api/metrics', { preHandler: [bearerAuthHook] }, async (_req, reply) => {
    try {
      const safetySnapshot = runtimeSafetyMetricsCollector.getSnapshot();
      const alertThresholds = {
        refusalRate: parseThreshold(process.env.ALERT_MAX_REFUSAL_RATE, 0.7),
        violationRate: parseThreshold(process.env.ALERT_MAX_VIOLATION_RATE, 0.1),
        retrievalEmptyRate: parseThreshold(process.env.ALERT_MAX_RETRIEVAL_EMPTY_RATE, 0.2),
        citationMissingRate: parseThreshold(process.env.ALERT_MAX_CITATION_MISSING_RATE, 0.05),
      };

      const safetyAlerts = {
        refusalRateDrift: safetySnapshot.refusalRate > alertThresholds.refusalRate,
        violationRateDrift: safetySnapshot.violationRate > alertThresholds.violationRate,
        retrievalEmptyRateDrift:
          safetySnapshot.retrievalEmptyRate > alertThresholds.retrievalEmptyRate,
        citationMissingRateDrift:
          safetySnapshot.citationMissingRate > alertThresholds.citationMissingRate,
      };

      const metrics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        memory: {
          rss: process.memoryUsage().rss,
          heapTotal: process.memoryUsage().heapTotal,
          heapUsed: process.memoryUsage().heapUsed,
          external: process.memoryUsage().external,
          arrayBuffers: process.memoryUsage().arrayBuffers,
        },
        cpu: { usage: process.cpuUsage() },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eventLoop: { loopUtilization: (process as any).eventLoopUtilization?.() ?? null },
        application: {
          activeConnections: 0,
          totalRequests: 0,
          averageResponseTime: 0,
        },
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
        system: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
        },
      };

      return reply
        .header('Cache-Control', 'no-cache')
        .code(200)
        .send(metrics);
    } catch (error) {
      return reply.code(500).send({
        error: 'Failed to collect metrics',
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get('/api/worker/health', async (_req, reply) => {
    try {
      const redis = createRedis();
      await redis.ping();

      const queue = new Queue('document-ingestion', {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          maxRetriesPerRequest: null,
        },
      });

      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
      ]);

      await queue.close();
      await redis.disconnect();

      return reply.code(200).send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: { redis: 'connected', queue: 'accessible' },
        stats: {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
        },
      });
    } catch (error) {
      return reply.code(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
