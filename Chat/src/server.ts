import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { logger } from '@/lib/logger';
import { registerRoutes } from '@/routes/index';

const PORT = parseInt(process.env.PORT ?? '4778', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

export async function buildApp(): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({
    logger: false, // use existing Winston logger
    trustProxy: true,
    bodyLimit: 52 * 1024 * 1024, // 52 MB — covers 50 MB upload route
  });

  await app.register(helmet);
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
  await app.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? false,
  });
  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  });

  registerRoutes(app);

  return app;
}

async function start(): Promise<void> {
  const app = await buildApp();
  await app.listen({ port: PORT, host: HOST });
  logger.info(`Chat service listening on ${HOST}:${PORT}`);
}

start().catch((err) => {
  logger.error({ error: err }, 'Failed to start server');
  process.exit(1);
});
