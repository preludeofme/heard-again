import { NextApiRequest, NextApiResponse } from 'next'
import { PrismaDocumentRepository } from '@/repositories/DocumentRepository'
import { queueManager, QUEUE_NAMES } from '@/utils/queues'
import { Document, DocumentStatus, DocumentType, EmbeddingStatus } from '@/types/retrieval'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

// RAG-extractable MIME types this service can process
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
])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Authenticate via shared secret
  const secret = req.headers['x-chat-service-secret']
  if (!secret || secret !== process.env.CHAT_SERVICE_SECRET) {
    logger.warn({ url: req.url }, 'Ingest request rejected — invalid or missing service secret')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { assetId, familyspaceId, storageUrl, mimeType, title, personId } = req.body

  if (!assetId || !familyspaceId || !storageUrl || !mimeType || !title) {
    logger.warn({ assetId, familyspaceId, mimeType }, 'Ingest request rejected — missing required fields')
    return res.status(400).json({
      error: 'Missing required fields: assetId, familyspaceId, storageUrl, mimeType, title',
    })
  }

  logger.info({ assetId, familyspaceId, mimeType, title, personId: personId ?? null }, 'RAG ingest request received')

  if (!EXTRACTABLE_MIME_TYPES.has(mimeType)) {
    logger.info({ assetId, mimeType }, 'MIME type not RAG-extractable — skipping')
    return res.status(200).json({
      message: `MIME type '${mimeType}' is not RAG-extractable — skipped`,
      assetId,
    })
  }

  // SECURITY: Validate storageUrl origin before queuing — prevents SSRF in the worker.
  // Set STORAGE_ALLOWED_ORIGINS as a comma-separated list of URL prefixes, e.g.
  // "https://storage.googleapis.com,https://s3.amazonaws.com,http://localhost:9000"
  const allowedOrigins = (process.env.STORAGE_ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)
  if (allowedOrigins.length > 0) {
    const isAllowed = allowedOrigins.some(origin => storageUrl.startsWith(origin))
    if (!isAllowed) {
      logger.warn({ assetId, storageUrl: storageUrl.split('?')[0] }, 'Ingest rejected — storageUrl origin not on allowlist')
      return res.status(400).json({ error: 'storageUrl origin is not on the allowlist' })
    }
  }

  try {
    const documentId = uuidv4()

    // Create or update Document record in the Chat DB.
    // Using upsertByAssetId so that re-ingestion of a retroactively-linked asset
    // updates the existing record's personId instead of creating a duplicate.
    const documentRepository = new PrismaDocumentRepository()
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
    }

    const savedDocument = await documentRepository.upsertByAssetId(document)
    logger.info({ assetId, documentId: savedDocument.id, familyspaceId, personId: personId ?? null }, 'Document record upserted in Chat DB')

    // Queue ingestion job — the worker downloads the file from storageUrl directly.
    // This keeps the Chat API stateless (no local file I/O, no shared volume needed).
    const traceId = uuidv4()
    const queue = queueManager.createQueue(QUEUE_NAMES.DOCUMENT_INGESTION)
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
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      }
    )
    logger.info({ assetId, documentId: savedDocument.id, jobId: job.id, traceId, mimeType, title }, 'Document queued for RAG ingestion ✓')

    return res.status(202).json({
      success: true,
      documentId: savedDocument.id,
      message: 'Document queued for RAG ingestion',
    })
  } catch (error) {
    logger.error({ assetId, familyspaceId, mimeType, err: error instanceof Error ? error.message : String(error) }, 'RAG ingest failed — document not queued')
    return res.status(500).json({
      error: 'Failed to queue document for ingestion',
    })
  }
}
