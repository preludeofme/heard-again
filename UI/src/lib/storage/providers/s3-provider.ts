import { logger } from '@/lib/logger'
import { StorageProvider } from './index'
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

export interface S3StorageConfig {
  bucket: string
  region: string
  accessKey: string
  secretKey: string
  endpoint?: string
  publicUrlBase?: string
}

export class S3StorageProvider implements StorageProvider {
  private client: S3Client
  private bucket: string
  private region: string
  private publicUrlBase?: string

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket
    this.region = config.region
    this.publicUrlBase = config.publicUrlBase

    // Initialize S3 client
    const clientConfig: any = {
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    }

    // Add custom endpoint for R2 or other S3-compatible services
    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint
      // Force path-style addressing for R2
      clientConfig.forcePathStyle = true
    }

    this.client = new S3Client(clientConfig)
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

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
      Body: buffer,
      ContentType: mimeType,
      Metadata: options?.metadata || {},
    })

    await this.client.send(command)

    const publicUrl = await this.getPublicUrl(storagePath)

    return {
      id,
      filename,
      storagePath,
      publicUrl,
      sizeBytes,
    }
  }

  async deleteFile(storagePath: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      })
      await this.client.send(command)
    } catch (error) {
      logger.error('Failed to delete S3 file:', error)
      throw error
    }
  }

  async getPublicUrl(storagePath: string): Promise<string> {
    if (this.publicUrlBase) {
      return `${this.publicUrlBase}/${storagePath}`
    }

    // For AWS S3, construct the standard URL
    if (!this.publicUrlBase) {
      return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${storagePath}`
    }

    // For custom endpoints (like R2), construct the URL
    return `${storagePath}`
  }

  async getFile(storagePath: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      })
      
      const response = await this.client.send(command)
      
      if (!response.Body) {
        throw new Error('File not found')
      }

      // Convert stream to buffer
      const chunks: any[] = []
      for await (const chunk of response.Body as any) {
        chunks.push(chunk)
      }
      
      return Buffer.concat(chunks)
    } catch (error) {
      logger.error('Failed to read S3 file:', error)
      throw error
    }
  }

  // Helper method to generate a presigned URL for direct uploads
  async getPresignedUploadUrl(
    filename: string,
    mimeType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: filename,
      ContentType: mimeType,
    })

    return await getSignedUrl(this.client, command, { expiresIn })
  }

  // Helper method to generate a presigned URL for downloads
  async getPresignedDownloadUrl(
    storagePath: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
    })

    return await getSignedUrl(this.client, command, { expiresIn })
  }

  // Get secure URL with short expiration for private content
  async getSecureUrl(
    storagePath: string,
    expiresInSeconds: number = 900 // 15 minutes default
  ): Promise<{ url: string; expiresAt: Date }> {
    const url = await this.getPresignedDownloadUrl(storagePath, expiresInSeconds)
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000)
    
    return { url, expiresAt }
  }
}
