import type { FastifyInstance } from 'fastify';
import { registerHealthRoutes } from './health';
import { registerChatRoutes } from './chat';
import { registerIngestionRoutes } from './ingestion';
import { registerPersonaRoutes } from './persona';
import { registerVoiceRoutes } from './voice';
import { registerMiscRoutes } from './misc';

export function registerRoutes(app: FastifyInstance): void {
  registerHealthRoutes(app);
  registerChatRoutes(app);
  registerIngestionRoutes(app);
  registerPersonaRoutes(app);
  registerVoiceRoutes(app);
  registerMiscRoutes(app);
}
