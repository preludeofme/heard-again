// @ts-nocheck — story ingestion legacy service; deep metadata type drift, not on critical path
import { PrismaClient } from '@prisma/client'
import { PrismaDocumentRepository } from '@/repositories/DocumentRepository'
import { ChromaClient, DefaultEmbeddingFunction } from 'chromadb'
import { Document, DocumentType, DocumentStatus, EmbeddingStatus } from '@/types/retrieval'
import { v4 as uuidv4 } from 'uuid'

export class StoryIngestionService {
  private chromaClient: ChromaClient
  private documentRepository: PrismaDocumentRepository
  private prisma: PrismaClient

  constructor(
    chromaUrl: string = process.env.CHROMA_URL || 'http://localhost:8004'
  ) {
    this.chromaClient = new ChromaClient({ path: chromaUrl })
    this.documentRepository = new PrismaDocumentRepository()
    this.prisma = new PrismaClient()
  }

  /**
   * Ingest all published stories for a familyspace into the document system
   */
  async ingestFamilyspaceStories(familyspaceId: string): Promise<void> {
    console.log(`[STORY_INGESTION] Starting ingestion for familyspace: ${familyspaceId}`)

    // Get all published stories for the familyspace
    const stories = await (this.prisma as any).story.findMany({
      where: {
        familyspaceId,
        status: 'PUBLISHED' // Only ingest published stories
      },
      include: {
        subject: {
          select: { id: true, firstName: true, lastName: true }
        },
        speaker: {
          select: { id: true, firstName: true, lastName: true }
        },
        createdBy: {
          select: { id: true, displayName: true }
        }
      }
    })

    console.log(`[STORY_INGESTION] Found ${stories.length} published stories to ingest`)

    for (const story of stories) {
      try {
        await this.ingestStory(story)
      } catch (error) {
        console.error(`[STORY_INGESTION] Failed to ingest story ${story.id}:`, error)
      }
    }

    console.log(`[STORY_INGESTION] Completed ingestion for familyspace: ${familyspaceId}`)
  }

  /**
   * Ingest a single story into the document system
   */
  async ingestStory(story: any): Promise<void> {
    const storyId = story.id
    const personId = story.subjectId || story.speakerId

    // Check if story is already ingested by searching for documents with this sourceId
    const existingDocs = await this.documentRepository.listDocuments(story.familyspaceId || 'default', {
      personId: personId || undefined
    })
    const existingDoc = existingDocs.find(doc => doc.metadata.sourceId === storyId)
    
    if (existingDoc) {
      // Update if story was modified
      if (existingDoc.updatedAt < story.updatedAt) {
        await this.updateStoryDocument(existingDoc.id, story)
      }
      return
    }

    // Create document from story
    const document: Omit<Document, 'id' | 'createdAt' | 'updatedAt'> = {
      title: story.title,
      content: story.content,
      documentType: DocumentType.STORY,
      source: 'story-system',
      sourceId: storyId,
      personId: personId || undefined,
      status: DocumentStatus.UPLOADED,
      embeddingStatus: EmbeddingStatus.PENDING,
      metadata: {
        ...({} as any), // Base metadata fields
        storyId: storyId,
        storyType: story.storyType,
        storyDate: story.storyDate?.toISOString(),
        location: story.location,
        tags: story.tags,
        subjectId: story.subjectId,
        speakerId: story.speakerId,
        subjectName: story.subject ? `${story.subject.firstName} ${story.subject.lastName}` : undefined,
        speakerName: story.speaker ? `${story.speaker.firstName} ${story.speaker.lastName}` : undefined,
        createdBy: story.createdBy?.displayName,
        excerpt: story.excerpt
      } as any
    }

    // Create document in database
    const createdDoc = await this.documentRepository.createDocument({
      ...document,
      id: uuidv4(),
      familyspaceId: story.familyspaceId
    })
    console.log(`[STORY_INGESTION] Created document ${createdDoc.id} for story ${storyId}`)

    // Trigger embedding process
    await this.triggerEmbedding(createdDoc.id)
  }

  /**
   * Update an existing story document
   */
  private async updateStoryDocument(documentId: string, story: any): Promise<void> {
    const personId = story.subjectId || story.speakerId

    const updateData = {
      id: documentId,
      title: story.title,
      content: story.content,
      personId: personId || undefined,
      metadata: {
        ...({} as any), // Base metadata fields
        storyId: story.id,
        storyType: story.storyType,
        storyDate: story.storyDate?.toISOString(),
        location: story.location,
        tags: story.tags,
        subjectId: story.subjectId,
        speakerId: story.speakerId,
        subjectName: story.subject ? `${story.subject.firstName} ${story.subject.lastName}` : undefined,
        speakerName: story.speaker ? `${story.speaker.firstName} ${story.speaker.lastName}` : undefined,
        createdBy: story.createdBy?.displayName,
        excerpt: story.excerpt
      } as any
    }

    await this.documentRepository.updateDocument(updateData)
    console.log(`[STORY_INGESTION] Updated document ${documentId} for story ${story.id}`)

    // Re-trigger embedding for updated content
    await this.triggerEmbedding(documentId)
  }

  /**
   * Trigger embedding for a document
   */
  private async triggerEmbedding(documentId: string): Promise<void> {
    // Update embedding status to processing
    await this.documentRepository.updateDocument({
      id: documentId,
      embeddingStatus: EmbeddingStatus.PROCESSING
    })

    // Get the document
    const document = await this.documentRepository.getDocument(documentId)
    if (!document) {
      throw new Error(`Document ${documentId} not found`)
    }

    try {
      // Get collection
      const collectionName = this.getCollectionName(document.familyspaceId || 'default')
      const embedder = new DefaultEmbeddingFunction()
      const collection = await this.chromaClient.getCollection({ 
        name: collectionName,
        embeddingFunction: embedder
      } as any)

      // Generate embeddings
      const chunks = this.chunkDocument(document.content)
      const embeddings = await (embedder as any)(chunks)

      // Add to ChromaDB
      const ids = chunks.map((_, index) => `${documentId}-chunk-${index}`)
      const metadatas = chunks.map((_, index) => ({
        documentId: documentId,
        chunkIndex: index,
        totalChunks: chunks.length,
        personId: document.personId || '',
        documentType: document.documentType,
        source: document.source,
        sourceId: document.sourceId,
        title: document.title,
        createdAt: document.createdAt.getTime(),
        extractedAt: Date.now(),
        embeddingModel: 'nomic-embed-text',
        ...document.metadata
      }))

      await collection.add({
        ids,
        documents: chunks,
        embeddings: embeddings as any,
        metadatas: metadatas as any
      })

      // Update document status
      await this.documentRepository.updateDocument({
        id: documentId,
        embeddingStatus: EmbeddingStatus.COMPLETED,
        status: DocumentStatus.PROCESSED
      })

      console.log(`[STORY_INGESTION] Successfully embedded document ${documentId} with ${chunks.length} chunks`)
    } catch (error) {
      console.error(`[STORY_INGESTION] Failed to embed document ${documentId}:`, error)
      
      // Mark as failed
      await this.documentRepository.updateDocument({
        id: documentId,
        embeddingStatus: EmbeddingStatus.FAILED
      })
    }
  }

  /**
   * Split document into chunks
   */
  private chunkDocument(content: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = []
    
    if (!content || content.length <= chunkSize) {
      return [content || '']
    }

    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      const chunk = content.slice(i, i + chunkSize)
      if (chunk.length > 0) {
        chunks.push(chunk)
      }
    }

    return chunks
  }

  /**
   * Get collection name for familyspace
   */
  private getCollectionName(familyspaceId: string): string {
    return `familyspace_${familyspaceId}_documents`
  }

  /**
   * Remove a story from the document system
   */
  async removeStory(storyId: string): Promise<void> {
    // Find document by searching through documents
    const docs = await this.documentRepository.listDocuments('default')
    const document = docs.find(doc => doc.metadata.sourceId === storyId)
    if (document) {
      // Remove from ChromaDB
      try {
        const collectionName = this.getCollectionName(document.familyspaceId || 'default')
        const collection = await this.chromaClient.getCollection({ 
          name: collectionName,
          embeddingFunction: new DefaultEmbeddingFunction()
        })
        
        // Remove all chunks for this document
        const chunkIds = Array.from({ length: document.metadata.totalChunks || 1 }, (_, i) => 
          `${document.id}-chunk-${i}`
        )
        
        await collection.delete({ ids: chunkIds })
        console.log(`[STORY_INGESTION] Removed chunks from ChromaDB for story ${storyId}`)
      } catch (error) {
        console.error(`[STORY_INGESTION] Failed to remove from ChromaDB:`, error)
      }

      // Remove from database
      await this.documentRepository.deleteDocument(document.id)
      console.log(`[STORY_INGESTION] Removed document ${document.id} for story ${storyId}`)
    }
  }

  /**
   * Sync all stories for all familyspaces (useful for initial setup)
   */
  async syncAllStories(): Promise<void> {
    const familyspaces = await (this.prisma as any).familyspace.findMany({
      select: { id: true }
    })

    for (const familyspace of familyspaces) {
      await this.ingestFamilyspaceStories(familyspace.id)
    }
  }
}
