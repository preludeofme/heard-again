import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { ChromaClient, DefaultEmbeddingFunction } from 'chromadb'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = req.headers['x-chat-service-secret']
  if (!secret || secret !== process.env.CHAT_SERVICE_SECRET) {
    logger.warn({ url: req.url }, 'Ingestion delete rejected — invalid or missing service secret')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { assetId, familyspaceId } = req.body
  if (!assetId || !familyspaceId) {
    return res.status(400).json({ error: 'Missing required fields: assetId, familyspaceId' })
  }

  const document = await (prisma as any).document.findFirst({
    where: { assetId, familyspaceId },
    include: { chunks: true },
  })

  if (!document) {
    return res.status(200).json({ success: true, removed: false, reason: 'document_not_found' })
  }

  try {
    const chunkIds: string[] = (document.chunks || []).map((chunk: any) => chunk.id)
    if (chunkIds.length > 0) {
      const chroma = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8004' })
      const collectionName = `familyspace_${familyspaceId}_documents`
      const collection = await chroma.getCollection({
        name: collectionName,
        embeddingFunction: new DefaultEmbeddingFunction(),
      } as any)

      await collection.delete({ ids: chunkIds })
      logger.info({ assetId, familyspaceId, documentId: document.id, chunkCount: chunkIds.length }, 'Removed document chunks from ChromaDB')
    }
  } catch (error) {
    logger.warn({ assetId, familyspaceId, err: error instanceof Error ? error.message : String(error) }, 'Failed removing chunks from ChromaDB; continuing with DB delete')
  }

  await (prisma as any).document.delete({ where: { id: document.id } })
  logger.info({ assetId, familyspaceId, documentId: document.id }, 'Removed document from Chat DB')

  return res.status(200).json({ success: true, removed: true, documentId: document.id })
}
