import {
  EmbeddingGenerator,
  Embedding,
  EmbeddingModelInfo,
  EmbeddingGenerationRequest,
  EmbeddingGenerationResult
} from '@/types'
import axios from 'axios'

export class EmbeddingGeneratorImpl implements EmbeddingGenerator {
  private ollamaUrl: string
  private modelName: string
  private batchSize: number
  private maxRetries: number

  constructor(
    ollamaUrl: string = process.env.OLLAMA_URL || 'http://localhost:11434',
    modelName: string = process.env.EMBEDDING_MODEL || 'nomic-embed-text',
    batchSize: number = parseInt(process.env.EMBEDDING_BATCH_SIZE || '10'),
    maxRetries: number = parseInt(process.env.EMBEDDING_MAX_RETRIES || '3')
  ) {
    this.ollamaUrl = ollamaUrl
    this.modelName = modelName
    this.batchSize = batchSize
    this.maxRetries = maxRetries
  }

  async generateEmbedding(text: string): Promise<Embedding> {
    const startTime = Date.now()
    const vectors = await this.generateEmbeddingsFromVectors([text])
    const vector = vectors[0]
    
    return {
      vector,
      dimension: vector.length,
      model: this.modelName,
      processingTime: Date.now() - startTime,
      tokenCount: Math.ceil(text.length / 4) // Rough token estimation
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<Embedding[]> {
    const startTime = Date.now()
    const vectors = await this.generateEmbeddingsFromVectors(texts)
    
    return vectors.map((vector: number[], index: number) => ({
      vector,
      dimension: vector.length,
      model: this.modelName,
      processingTime: Date.now() - startTime,
      tokenCount: Math.ceil(texts[index].length / 4) // Rough token estimation
    }))
  }

  async getModelInfo(): Promise<EmbeddingModelInfo> {
    return {
      name: this.modelName,
      dimension: 1536, // Default dimension, should be fetched from model
      maxTokens: 8192,
      supportedLanguages: ['en'],
      description: `Embedding model: ${this.modelName}`
    }
  }

  private async generateEmbeddingsFromVectors(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return []
    }

    const embeddings: number[][] = []
    
    // Process in batches to avoid overwhelming the model
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize)
      const batchEmbeddings = await this.generateBatchEmbeddingsVectors(batch)
      embeddings.push(...batchEmbeddings)
    }

    return embeddings
  }

  private async generateBatchEmbeddingsVectors(texts: string[]): Promise<number[][]> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const embeddings: number[][] = []

        for (const text of texts) {
          const embedding = await this.generateSingleEmbedding(text)
          embeddings.push(embedding)
        }

        return embeddings
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        if (attempt < this.maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
          console.warn(`Embedding generation attempt ${attempt + 1} failed, retrying in ${delay}ms...`)
          await this.sleep(delay)
        }
      }
    }

    throw lastError || new Error('Embedding generation failed after all retries')
  }

  private async generateSingleEmbedding(text: string): Promise<number[]> {
    const request = {
      model: this.modelName,
      prompt: text,
      options: {
        temperature: 0, // Deterministic embeddings
      }
    }

    const response = await axios.post(
      `${this.ollamaUrl}/api/embeddings`,
      request,
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    if (response.data && response.data.embedding) {
      return response.data.embedding
    } else {
      throw new Error('Invalid embedding response from Ollama')
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
