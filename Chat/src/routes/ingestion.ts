import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { PrismaDocumentRepository } from '@/repositories/DocumentRepository';
import { queueManager, QUEUE_NAMES } from '@/utils/queues';
import { SimpleIngestionService, SimpleDocumentProcessor } from '@/services/ingestion/SimpleIngestionService';
import { EmbeddingGeneratorImpl } from '@/services/ingestion/EmbeddingGenerator';
import { StoryIngestionService } from '@/services/ingestion/StoryIngestionService';
import { Document, DocumentStatus, DocumentType, EmbeddingStatus } from '@/types/retrieval';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { ChromaClient, DefaultEmbeddingFunction } from 'chromadb';
import { serviceSecretHook } from '@/hooks/auth';

const EXTRACTABLE_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/csv',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'image/tiff',
]);

export function registerIngestionRoutes(app: FastifyInstance): void {
  // POST /api/ingestion/ingest — service-secret auth
  app.post(
    '/api/ingestion/ingest',
    { preHandler: [serviceSecretHook] },
    async (req, reply) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { assetId, familyspaceId, storageUrl, mimeType, title, personId } = req.body as any;

      if (!assetId || !familyspaceId || !storageUrl || !mimeType || !title) {
        logger.warn({ assetId, familyspaceId, mimeType }, 'Ingest request rejected — missing required fields');
        return reply.code(400).send({
          error: 'Missing required fields: assetId, familyspaceId, storageUrl, mimeType, title',
        });
      }

      logger.info(
        { assetId, familyspaceId, mimeType, title, personId: personId ?? null },
        'RAG ingest request received',
      );

      if (!EXTRACTABLE_MIME_TYPES.has(mimeType)) {
        logger.info({ assetId, mimeType }, 'MIME type not RAG-extractable — skipping');
        return reply.code(200).send({
          message: `MIME type '${mimeType}' is not RAG-extractable — skipped`,
          assetId,
        });
      }

      // SECURITY: Validate storageUrl origin before queuing — prevents SSRF in the worker.
      const allowedOrigins = (process.env.STORAGE_ALLOWED_ORIGINS || '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);
      if (allowedOrigins.length > 0) {
        const isAllowed = allowedOrigins.some(origin => storageUrl.startsWith(origin));
        if (!isAllowed) {
          logger.warn(
            { assetId, storageUrl: storageUrl.split('?')[0] },
            'Ingest rejected — storageUrl origin not on allowlist',
          );
          return reply.code(400).send({ error: 'storageUrl origin is not on the allowlist' });
        }
      }

      try {
        const documentId = uuidv4();
        const documentRepository = new PrismaDocumentRepository();
        const document: Document = {
          id: documentId,
          familyspaceId,
          assetId: assetId || undefined,
          personId: personId || undefined,
          title,
          content: '',
          documentType: DocumentType.DOCUMENT,
          source: 'ui-upload',
          metadata: {
            originalFileName: title,
            mimeType,
            uploadedAt: new Date(),
          },
          status: DocumentStatus.PROCESSING,
          embeddingStatus: EmbeddingStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const savedDocument = await documentRepository.upsertByAssetId(document);
        logger.info(
          { assetId, documentId: savedDocument.id, familyspaceId, personId: personId ?? null },
          'Document record upserted in Chat DB',
        );

        const traceId = uuidv4();
        const queue = queueManager.createQueue(QUEUE_NAMES.DOCUMENT_INGESTION);
        const job = await queue.add(
          'process-document',
          {
            documentId: savedDocument.id,
            storageUrl,
            mimeType,
            familyspaceId,
            title,
            personId: personId || null,
            traceId,
          },
          { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
        );
        logger.info(
          { assetId, documentId: savedDocument.id, jobId: job.id, traceId, mimeType, title },
          'Document queued for RAG ingestion ✓',
        );

        return reply.code(202).send({
          success: true,
          documentId: savedDocument.id,
          message: 'Document queued for RAG ingestion',
        });
      } catch (error) {
        logger.error(
          { assetId, familyspaceId, mimeType, err: error instanceof Error ? error.message : String(error) },
          'RAG ingest failed — document not queued',
        );
        return reply.code(500).send({ error: 'Failed to queue document for ingestion' });
      }
    },
  );

  // POST /api/ingestion/upload — no auth (context headers required by caller)
  app.post(
    '/api/ingestion/upload',
    { bodyLimit: 52 * 1024 * 1024 },
    async (req, reply) => {
      const familyspaceId = req.headers['x-familyspace-id'] as string;
      const userId = req.headers['x-user-id'] as string;

      if (!familyspaceId || !userId) {
        return reply.code(400).send({
          error: 'Missing required headers: x-familyspace-id, x-user-id',
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = req.body as any;
      if (!body?.file) {
        return reply.code(400).send({ error: 'No file provided' });
      }

      try {
        const fileData = body.file;
        const buffer = Buffer.from(fileData.buffer);
        const file = new File([buffer], fileData.name, {
          type: fileData.type,
          lastModified: fileData.lastModified,
        });

        const documentRepository = new PrismaDocumentRepository();
        const embeddingGenerator = new EmbeddingGeneratorImpl();
        const ingestionService = new SimpleIngestionService(documentRepository, embeddingGenerator);
        const documentProcessor = new SimpleDocumentProcessor();

        const validation = await documentProcessor.validateFile(buffer, file.type);
        if (!validation.isValid) {
          return reply.code(400).send({ error: 'File validation failed', details: validation.errors });
        }

        const document: Document = {
          id: uuidv4(),
          familyspaceId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          personId: body.personId || null as any,
          title: fileData.name,
          content: '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          documentType: file.type as any,
          source: 'upload',
          metadata: {
            originalFileName: fileData.name,
            fileSize: fileData.size,
            mimeType: file.type,
            uploadedAt: new Date(),
          },
          status: DocumentStatus.PROCESSING,
          embeddingStatus: EmbeddingStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const savedDocument = await documentRepository.createDocument(document);
        const job = await ingestionService.ingestDocument(savedDocument.id);

        return reply.code(202).send({
          success: true,
          documentId: savedDocument.id,
          job,
          message: 'Document submitted for processing',
        });
      } catch (error) {
        return reply.code(500).send({
          error: 'Failed to upload document',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  // POST /api/ingestion/delete — service-secret auth (method is POST per existing API contract)
  app.post(
    '/api/ingestion/delete',
    { preHandler: [serviceSecretHook] },
    async (req, reply) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { assetId, familyspaceId } = req.body as any;
      if (!assetId || !familyspaceId) {
        return reply.code(400).send({ error: 'Missing required fields: assetId, familyspaceId' });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const document = await (prisma as any).document.findFirst({
        where: { assetId, familyspaceId },
        include: { chunks: true },
      });

      if (!document) {
        return reply.code(200).send({ success: true, removed: false, reason: 'document_not_found' });
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chunkIds: string[] = (document.chunks || []).map((chunk: any) => chunk.id);
        if (chunkIds.length > 0) {
          const chroma = new ChromaClient({
            path: process.env.CHROMA_URL || 'http://localhost:8004',
          });
          const collectionName = `familyspace_${familyspaceId}_documents`;
          const collection = await chroma.getCollection({
            name: collectionName,
            embeddingFunction: new DefaultEmbeddingFunction(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
          await collection.delete({ ids: chunkIds });
          logger.info(
            { assetId, familyspaceId, documentId: document.id, chunkCount: chunkIds.length },
            'Removed document chunks from ChromaDB',
          );
        }
      } catch (error) {
        logger.warn(
          { assetId, familyspaceId, err: error instanceof Error ? error.message : String(error) },
          'Failed removing chunks from ChromaDB; continuing with DB delete',
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).document.delete({ where: { id: document.id } });
      logger.info({ assetId, familyspaceId, documentId: document.id }, 'Removed document from Chat DB');

      return reply.code(200).send({ success: true, removed: true, documentId: document.id });
    },
  );

  // GET /api/ingestion/jobs/:id
  app.get<{ Params: { id: string } }>('/api/ingestion/jobs/:id', async (req, reply) => {
    const { id } = req.params;
    const mockJob = {
      id,
      status: 'running',
      progress: {
        currentStep: 'extracting_text',
        totalSteps: 5,
        completedSteps: 2,
        percentage: 40,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return reply.code(200).send({ success: true, job: mockJob });
  });

  app.post<{ Params: { id: string } }>('/api/ingestion/jobs/:id', async (req, reply) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { action } = req.body as any;
    if (action === 'cancel') {
      return reply.code(200).send({ success: true, message: 'Job cancellation requested' });
    } else if (action === 'retry') {
      return reply.code(200).send({ success: true, message: 'Job retry requested' });
    }
    return reply.code(400).send({ error: 'Invalid action' });
  });

  app.delete<{ Params: { id: string } }>('/api/ingestion/jobs/:id', async (req, reply) => {
    return reply.code(200).send({ success: true, message: 'Job deleted successfully' });
  });

  // POST /api/ingest/stories
  app.post('/api/ingest/stories', async (req, reply) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { familyspaceId, storyId, action = 'ingest' } = req.body as any;

      if (!familyspaceId && !storyId && action !== 'sync-all') {
        return reply.code(400).send({
          error: 'Missing required parameters. Provide familyspaceId, storyId, or use action=sync-all',
        });
      }

      const storyIngestion = new StoryIngestionService();

      switch (action) {
        case 'ingest-familyspace':
          if (!familyspaceId) {
            return reply.code(400).send({ error: 'familyspaceId is required for ingest-familyspace action' });
          }
          await storyIngestion.ingestFamilyspaceStories(familyspaceId);
          return reply.code(200).send({ message: `Successfully ingested stories for familyspace ${familyspaceId}` });

        case 'ingest-story': {
          if (!storyId) {
            return reply.code(400).send({ error: 'storyId is required for ingest-story action' });
          }
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { PrismaClient } = require('@prisma/client');
          const prismaClient = new PrismaClient();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const story = await (prismaClient as any).story.findUnique({
            where: { id: storyId },
            include: {
              subject: { select: { id: true, firstName: true, lastName: true } },
              speaker: { select: { id: true, firstName: true, lastName: true } },
              createdBy: { select: { id: true, displayName: true } },
            },
          });
          if (!story) {
            return reply.code(404).send({ error: 'Story not found' });
          }
          await storyIngestion.ingestStory(story);
          return reply.code(200).send({ message: `Successfully ingested story ${storyId}` });
        }

        case 'remove-story':
          if (!storyId) {
            return reply.code(400).send({ error: 'storyId is required for remove-story action' });
          }
          await storyIngestion.removeStory(storyId);
          return reply.code(200).send({ message: `Successfully removed story ${storyId} from search index` });

        case 'sync-all':
          await storyIngestion.syncAllStories();
          return reply.code(200).send({ message: 'Successfully synced all stories for all familyspaces' });

        default:
          return reply.code(400).send({
            error: `Invalid action: ${action}. Use ingest-familyspace, ingest-story, remove-story, or sync-all`,
          });
      }
    } catch (error) {
      return reply.code(500).send({
        error: 'Internal server error during story ingestion',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      });
    }
  });
}
