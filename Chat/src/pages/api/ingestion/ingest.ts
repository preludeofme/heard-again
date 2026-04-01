import { NextApiRequest, NextApiResponse } from 'next'
import { PrismaDocumentRepository } from '@/repositories/DocumentRepository'
import { queueManager, QUEUE_NAMES } from '@/utils/queues'
import { Document, DocumentStatus, EmbeddingStatus } from '@/types/retrieval'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import path from 'path'
import fs from 'fs'

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

  const { assetId, workspaceId, storageUrl, mimeType, title, personId } = req.body

  if (!assetId || !workspaceId || !storageUrl || !mimeType || !title) {
    logger.warn({ assetId, workspaceId, mimeType }, 'Ingest request rejected — missing required fields')
    return res.status(400).json({
      error: 'Missing required fields: assetId, workspaceId, storageUrl, mimeType, title',
    })
  }

  logger.info({ assetId, workspaceId, mimeType, title, personId: personId ?? null }, 'RAG ingest request received')

  if (!EXTRACTABLE_MIME_TYPES.has(mimeType)) {
    logger.info({ assetId, mimeType }, 'MIME type not RAG-extractable — skipping')
    return res.status(200).json({
      message: `MIME type '${mimeType}' is not RAG-extractable — skipped`,
      assetId,
    })
  }

  // SECURITY: Only allow downloads from configured storage origins to prevent SSRF.
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

  let filePath: string | null = null
  try {
    // Workspace-scoped temp directory prevents cross-tenant file commingling.
    const tempDir = path.join(process.cwd(), 'temp-ingestion', workspaceId)
    await fs.promises.mkdir(tempDir, { recursive: true })

    const documentId = uuidv4()
    const ext = getExtForMime(mimeType)
    filePath = path.join(tempDir, `${documentId}${ext}`)

    const response = await axios.get(storageUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
      maxContentLength: 100 * 1024 * 1024, // 100 MB hard cap
      maxBodyLength: 100 * 1024 * 1024,
      headers: {
        'X-Chat-Service-Secret': process.env.CHAT_SERVICE_SECRET || '',
      },
    })
    const fileBytes = Buffer.from(response.data)
    await fs.promises.writeFile(filePath, fileBytes)
    logger.info({ assetId, documentId, filePath, sizeBytes: fileBytes.length }, 'File downloaded to temp dir')

    // Create Document record in the Chat DB
    const documentRepository = new PrismaDocumentRepository()
    const document: Document = {
      id: documentId,
      workspaceId,
      personId: personId || undefined,
      title,
      documentType: 'DOCUMENT', // Use enum value, not MIME type
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

    const savedDocument = await documentRepository.createDocument(document)
    logger.info({ assetId, documentId: savedDocument.id, workspaceId }, 'Document record created in Chat DB')

    // Queue ingestion job for the worker to process
    const traceId = uuidv4()
    const queue = queueManager.createQueue(QUEUE_NAMES.DOCUMENT_INGESTION)
    const job = await queue.add(
      'process-document',
      {
        documentId: savedDocument.id,
        filePath,
        mimeType,
        workspaceId,
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
    // Clean up temp file on any error path to avoid sensitive data accumulation.
    if (filePath) {
      fs.unlink(filePath, () => {}) // best-effort, non-blocking
    }
    logger.error({ assetId, workspaceId, mimeType, err: error instanceof Error ? error.message : String(error) }, 'RAG ingest failed — document not queued')
    return res.status(500).json({
      error: 'Failed to queue document for ingestion',
    })
  }
}

function getExtForMime(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'text/markdown': '.md',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/tiff': '.tiff',
  }
  return map[mimeType] || '.bin'
}
