import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { logger } from '@/lib/logger';

export function bearerAuthHook(
  req: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  const secret = process.env.CHAT_SERVICE_SECRET;
  if (!secret) {
    logger.error('[AUTH] CHAT_SERVICE_SECRET is not configured — denying all requests');
    reply.code(500).send({ error: 'Service misconfigured' });
    return;
  }
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || token !== secret) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  done();
}

export function serviceSecretHook(
  req: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  const secret = process.env.CHAT_SERVICE_SECRET;
  if (!secret) {
    logger.error('[AUTH] CHAT_SERVICE_SECRET is not configured — denying all requests');
    reply.code(500).send({ error: 'Service misconfigured' });
    return;
  }
  const headerSecret = req.headers['x-chat-service-secret'];
  if (!headerSecret || headerSecret !== secret) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  done();
}

export function requireContextHeadersHook(
  req: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  if (!req.headers['x-familyspace-id'] || !req.headers['x-user-id']) {
    reply.code(400).send({ error: 'Missing required context headers' });
    return;
  }
  done();
}
