/**
 * StorageService - Abstraction for file storage operations
 * Supports Local filesystem, AWS S3, and Cloudflare R2
 */

import fs from 'fs/promises'
import path from 'path'
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

export interface StorageConfig {
  type: 'LOCAL' | 'S3' | 'R2'
  basePath?: string  // For local storage
  // S3/R2 settings
  endpoint?: string
  region?: string
  bucket?: string
  accessKeyId?: string
  secretAccessKey?: string
  publicUrlPrefix?: string
}

export interface StoredFile {
  path: string  // For local: relative path, For S3: object key
  url: string
  sizeBytes: number
  mimeType: string
}

export class StorageService {
  private config: StorageConfig
  private s3Client: S3Client | null = null

  constructor(config: StorageConfig) {
    this.config = config
    
    // Initialize S3 client for S3/R2 storage
    if (config.type === 'S3' || config.type === 'R2') {
      if (!config.endpoint || !config.accessKeyId || !config.secretAccessKey || !config.bucket) {
        throw new Error('S3/R2 storage requires endpoint, accessKeyId, secretAccessKey, and bucket')
      }
      
      this.s3Client = new S3Client({
        region: config.region || 'auto',
        endpoint: config.endpoint,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        forcePathStyle: config.type === 'R2', // R2 requires path-style URLs
      })
    }
    
    // Validate local storage config
    if (config.type === 'LOCAL' && !config.basePath) {
      throw new Error('Local storage requires basePath')
    }
  }

  /**
   * Save audio file to storage
   */
  async saveAudio(
    familyspaceId: string,
    audioId: string,
    buffer: Buffer,
    options?: {
      mimeType?: string
      extension?: string
    }
  ): Promise<StoredFile> {
    const extension = options?.extension || 'wav'
    const mimeType = options?.mimeType || 'audio/wav'
    
    const relativePath = this.buildAudioPath(familyspaceId, `${audioId}.${extension}`)
    
    if (this.config.type === 'LOCAL') {
      return this.saveToLocal(relativePath, buffer, mimeType)
    } else {
      return this.saveToS3(relativePath, buffer, mimeType)
    }
  }

  /**
   * Save generic file to storage
   */
  async saveFile(
    familyspaceId: string,
    fileId: string,
    buffer: Buffer,
    options: {
      mimeType: string
      filename: string
      assetType: string
    }
  ): Promise<StoredFile> {
    const relativePath = this.buildFilePath(familyspaceId, fileId, options.filename)
    
    if (this.config.type === 'LOCAL') {
      return this.saveToLocal(relativePath, buffer, options.mimeType)
    } else {
      return this.saveToS3(relativePath, buffer, options.mimeType)
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(filePath: string): Promise<void> {
    if (this.config.type === 'LOCAL') {
      const absolutePath = path.join(this.config.basePath!, filePath)
      try {
        await fs.unlink(absolutePath)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
      }
    } else if (this.s3Client) {
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: this.config.bucket!,
        Key: filePath,
      }))
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    if (this.config.type === 'LOCAL') {
      const absolutePath = path.join(this.config.basePath!, filePath)
      try {
        await fs.access(absolutePath)
        return true
      } catch {
        return false
      }
    } else if (this.s3Client) {
      try {
        await this.s3Client.send(new HeadObjectCommand({
          Bucket: this.config.bucket!,
          Key: filePath,
        }))
        return true
      } catch {
        return false
      }
    }
    return false
  }

  /**
   * Get absolute path from relative path (local only)
   */
  getAbsolutePath(relativePath: string): string {
    if (this.config.type !== 'LOCAL') {
      throw new Error('getAbsolutePath is only available for local storage')
    }
    return path.join(this.config.basePath!, relativePath)
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(filePath: string): string {
    if (this.config.publicUrlPrefix) {
      return `${this.config.publicUrlPrefix}/${filePath.replace(/\\/g, '/')}`
    }
    // Default: serve through local API
    return `/api/files/${filePath.replace(/\\/g, '/')}`
  }

  // Private helper methods

  private async saveToLocal(relativePath: string, buffer: Buffer, mimeType: string): Promise<StoredFile> {
    const absolutePath = path.join(this.config.basePath!, relativePath)
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    
    // Write file
    await fs.writeFile(absolutePath, buffer)

    return {
      path: relativePath,
      url: this.getPublicUrl(relativePath),
      sizeBytes: buffer.byteLength,
      mimeType,
    }
  }

  private async saveToS3(key: string, buffer: Buffer, mimeType: string): Promise<StoredFile> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized')
    }

    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.config.bucket!,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }))

    return {
      path: key,
      url: this.getPublicUrl(key),
      sizeBytes: buffer.byteLength,
      mimeType,
    }
  }

  /**
   * Build path for audio files
   */
  private buildAudioPath(familyspaceId: string, filename: string): string {
    return path.join('generated', familyspaceId, 'voice', filename)
  }

  /**
   * Build path for generic files
   */
  private buildFilePath(familyspaceId: string, fileId: string, filename: string): string {
    const now = new Date()
    const datePath = path.join(
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    )
    return path.join('uploads', familyspaceId, datePath, `${fileId}_${filename}`)
  }
}

// Default instance for server-side usage (local storage)
export const storageService = new StorageService({
  type: 'LOCAL',
  basePath: process.cwd(),
  publicUrlPrefix: undefined,
})

// Factory for creating instances with custom config
export function createStorageService(config: StorageConfig): StorageService {
  return new StorageService(config)
}

// Factory for creating S3/R2 storage from environment variables
export function createCloudStorageService(type: 'S3' | 'R2'): StorageService {
  const prefix = type === 'R2' ? 'R2' : 'S3'
  
  const endpoint = process.env[`${prefix}_ENDPOINT`]
  const accessKeyId = process.env[`${prefix}_ACCESS_KEY_ID`]
  const secretAccessKey = process.env[`${prefix}_SECRET_ACCESS_KEY`]
  const bucket = process.env[`${prefix}_BUCKET`]
  const region = process.env[`${prefix}_REGION`]
  const publicUrlPrefix = process.env[`${prefix}_PUBLIC_URL`]
  
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(`Missing ${prefix} storage configuration environment variables`)
  }
  
  return new StorageService({
    type,
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicUrlPrefix,
  })
}
