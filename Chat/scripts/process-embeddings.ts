import { PrismaDocumentRepository } from '../src/repositories/DocumentRepository'
import { EmbeddingGeneratorImpl } from '../src/services/ingestion/EmbeddingGenerator'
import { ChromaClient } from 'chromadb'
import { prisma } from '../src/lib/prisma'
import { DocumentStatus, EmbeddingStatus } from '../src/types'

async function processEmbeddings() {
  console.log('Starting embedding process...')
  
  const documentRepository = new PrismaDocumentRepository()
  const embeddingGenerator = new EmbeddingGeneratorImpl()
  const chromaClient = new ChromaClient({ path: 'http://localhost:8004' })
  
  // Get all documents with PENDING embedding status
  const documents = await documentRepository.listDocuments('931638b2-8341-41fc-a064-0883a9911d54')
  const pendingDocuments = documents.filter(doc => doc.embeddingStatus === EmbeddingStatus.PENDING)
  
  console.log(`Found ${pendingDocuments.length} documents to process`)
  
  for (const document of pendingDocuments) {
    try {
      console.log(`Processing document: ${document.id}`)
      
      // Generate embeddings for the document content
      const embedding = await embeddingGenerator.generateEmbedding(document.content || '')
      
      // Create or get ChromaDB collection
      const collectionName = `familyspace_${document.familyspaceId}_documents`
      let collection
      try {
        collection = await chromaClient.getCollection({ name: collectionName } as any)
      } catch (error) {
        console.log(`Creating new collection: ${collectionName}`)
        collection = await chromaClient.createCollection({ name: collectionName } as any)
      }
      
      // Add document to ChromaDB
      await collection.add({
        ids: [document.id],
        embeddings: [embedding.vector],
        documents: [document.content || ''],
        metadatas: [{
          documentId: document.id,
          personId: document.personId || '',
          documentType: document.documentType,
          title: document.title,
          source: document.source,
          createdAt: document.createdAt.getTime()
        }]
      })
      
      // Update document status
      await (prisma as any).document.update({
        where: { id: document.id },
        data: {
          embeddingStatus: EmbeddingStatus.COMPLETED,
          status: DocumentStatus.PROCESSED
        }
      })
      
      console.log(`Successfully processed document: ${document.id}`)
    } catch (error) {
      console.error(`Failed to process document ${document.id}:`, error)
      
      // Mark as failed
      await (prisma as any).document.update({
        where: { id: document.id },
        data: {
          embeddingStatus: EmbeddingStatus.FAILED
        }
      })
    }
  }
  
  console.log('Embedding process completed!')
}

processEmbeddings().catch(console.error)
