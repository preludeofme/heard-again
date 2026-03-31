import { StorageProvider } from './index'
import { Storage } from '@google-cloud/storage'
import { v4 as uuidv4 } from 'uuid'

export interface GCPStorageConfig {
  bucketName: string
  keyFilename?: string
  projectId?: string
}

export class GCPStorageProvider implements StorageProvider {
  private storage: Storage
  private bucketName: string

  constructor(config: GCPStorageConfig) {
    this.bucketName = config.bucketName
    
    // Initialize Google Cloud Storage
    const storageOptions: any = {}
    if (config.keyFilename) {
      storageOptions.keyFilename = config.keyFilename
    }
    if (config.projectId) {
      storageOptions.projectId = config.projectId
    }
    
    // If no key file is provided, try to use default credentials (e.g., in production)
    this.storage = new Storage(storageOptions)
  }

  async uploadFile(
    file: Buffer | File,
    filename: string,
    mimeType: string,
    options?: {
      folder?: string
      metadata?: Record<string, string>
    }
  ): Promise<{
    id: string
    filename: string
    storagePath: string
    publicUrl: string
    sizeBytes: number
  }> {
    const id = uuidv4()
    const storagePath = options?.folder ? `${options.folder}/${filename}` : filename
    
    let buffer: Buffer
    let sizeBytes: number
    
    if (file instanceof File) {
      buffer = Buffer.from(await file.arrayBuffer())
      sizeBytes = file.size
    } else {
      buffer = file
      sizeBytes = buffer.length
    }

    const bucket = this.storage.bucket(this.bucketName)
    const fileObject = bucket.file(storagePath)

    // Upload the file
    await fileObject.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: options?.metadata || {},
      },
    })

    // Files are private by default - no public access

    return {
      id,
      filename,
      storagePath,
      publicUrl: '', // No public URLs - use signed URLs instead
      sizeBytes,
    }
  }

  async deleteFile(storagePath: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName)
      const fileObject = bucket.file(storagePath)
      await fileObject.delete()
    } catch (error) {
      console.error('Failed to delete GCP file:', error)
      throw error
    }
  }

  async getPublicUrl(storagePath: string): Promise<string> {
    throw new Error('Public URLs not supported. Use getSignedUrl instead.')
  }

  async getSignedUrl(storagePath: string, expiresIn: number = 15 * 60): Promise<string> {
    try {
      const bucket = this.storage.bucket(this.bucketName)
      const fileObject = bucket.file(storagePath)
      
      const [signedUrl] = await fileObject.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresIn * 1000, // expiresIn is in seconds
      })
      
      return signedUrl
    } catch (error) {
      console.error('Failed to generate signed URL:', error)
      throw error
    }
  }

  async getFile(storagePath: string): Promise<Buffer> {
    try {
      const bucket = this.storage.bucket(this.bucketName)
      const fileObject = bucket.file(storagePath)
      const [buffer] = await fileObject.download()
      return buffer
    } catch (error) {
      console.error('Failed to read GCP file:', error)
      throw error
    }
  }

  // Helper method to check if bucket exists and create if needed
  async ensureBucket(): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName)
      const [exists] = await bucket.exists()
      if (!exists) {
        await bucket.create()
        console.log(`Created GCS bucket: ${this.bucketName}`)
      }
    } catch (error) {
      console.error('Failed to ensure GCS bucket:', error)
      throw error
    }
  }

  // Helper method to set CORS configuration for the bucket
  async setCorsConfiguration(): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName)
      
      const corsConfiguration = [
        {
          maxAgeSeconds: 3600,
          method: ['GET', 'HEAD'],
          origin: [], // No cross-origin access for production
          responseHeader: ['Content-Type'],
        },
      ]

      await bucket.setCorsConfiguration(corsConfiguration)
      console.log('CORS configuration set for bucket:', this.bucketName)
    } catch (error) {
      console.error('Failed to set CORS configuration:', error)
      // Don't throw here - this is not critical for basic functionality
    }
  }
}
