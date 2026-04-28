import { NextApiRequest, NextApiResponse } from 'next'
import { SimpleIngestionService, SimpleDocumentProcessor } from '@/services/ingestion/SimpleIngestionService'
import { PrismaDocumentRepository } from '@/repositories/DocumentRepository'
import { EmbeddingGeneratorImpl } from '@/services/ingestion/EmbeddingGenerator'
import { Document, DocumentStatus, EmbeddingStatus } from '@/types/retrieval'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Extract familyspace and user info from headers or auth context
    const familyspaceId = req.headers['x-familyspace-id'] as string
    const userId = req.headers['x-user-id'] as string

    if (!familyspaceId || !userId) {
      return res.status(400).json({ 
        error: 'Missing required headers: x-familyspace-id, x-user-id' 
      })
    }

    // Check if file is present
    if (!req.body || !req.body.file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    // Parse file from request
    const fileData = req.body.file
    const buffer = Buffer.from(fileData.buffer)
    const file = new File([buffer], fileData.name, {
      type: fileData.type,
      lastModified: fileData.lastModified
    })

    // Create services
    const documentRepository = new PrismaDocumentRepository()
    const embeddingGenerator = new EmbeddingGeneratorImpl()
    const ingestionService = new SimpleIngestionService(
      documentRepository,
      embeddingGenerator
    )
    const documentProcessor = new SimpleDocumentProcessor()

    // Validate file
    const validation = await documentProcessor.validateFile(buffer, file.type)
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: 'File validation failed',
        details: validation.errors
      })
    }

    // Create document record
    const document: Document = {
      id: uuidv4(),
      familyspaceId,
      personId: req.body.personId || null,
      title: fileData.name,
      content: '', // Will be populated during processing
      documentType: file.type as any,
      source: 'upload',
      metadata: {
        originalFileName: fileData.name,
        fileSize: fileData.size,
        mimeType: file.type,
        uploadedAt: new Date()
      },
      status: DocumentStatus.PROCESSING,
      embeddingStatus: EmbeddingStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Save document to database
    const savedDocument = await documentRepository.createDocument(document)

    // Start ingestion process
    const job = await ingestionService.ingestDocument(savedDocument.id)

    res.status(202).json({
      success: true,
      documentId: savedDocument.id,
      job,
      message: 'Document submitted for processing'
    })

  } catch (error) {
    console.error('Document upload error:', error)
    res.status(500).json({
      error: 'Failed to upload document',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Configure API to handle file uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb' // Set to match max file size
    }
  }
}
