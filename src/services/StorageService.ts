/**
 * StorageService - Abstraction for file storage operations
 * Finding 5.8: Extract Storage Abstraction
 * Handles path construction and storage backend (local vs S3)
 */

import fs from 'fs/promises'
import path from 'path'

export interface StorageConfig {
  type: 'LOCAL' | 'S3'
  basePath: string
  publicUrlPrefix?: string
}

export interface StoredFile {
  path: string
  url: string
  sizeBytes: number
  mimeType: string
}

export class StorageService {
  private config: StorageConfig

  constructor(config: StorageConfig) {
    this.config = config
  }

  /**
   * Save audio file to storage
   */
  async saveAudio(
    workspaceId: string,
    audioId: string,
    buffer: Buffer,
    options?: {
      mimeType?: string
      extension?: string
    }
  ): Promise<StoredFile> {
    const extension = options?.extension || 'wav'
    const mimeType = options?.mimeType || 'audio/wav'
    
    const relativePath = this.buildAudioPath(workspaceId, `${audioId}.${extension}`)
    const absolutePath = path.join(this.config.basePath, relativePath)

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

  /**
   * Save generic file to storage
   */
  async saveFile(
    workspaceId: string,
    fileId: string,
    buffer: Buffer,
    options: {
      mimeType: string
      filename: string
      assetType: string
    }
  ): Promise<StoredFile> {
    const relativePath = this.buildFilePath(workspaceId, fileId, options.filename)
    const absolutePath = path.join(this.config.basePath, relativePath)

    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, buffer)

    return {
      path: relativePath,
      url: this.getPublicUrl(relativePath),
      sizeBytes: buffer.byteLength,
      mimeType: options.mimeType,
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(relativePath: string): Promise<void> {
    const absolutePath = path.join(this.config.basePath, relativePath)
    try {
      await fs.unlink(absolutePath)
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(relativePath: string): Promise<boolean> {
    const absolutePath = path.join(this.config.basePath, relativePath)
    try {
      await fs.access(absolutePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get absolute path from relative path
   */
  getAbsolutePath(relativePath: string): string {
    return path.join(this.config.basePath, relativePath)
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(relativePath: string): string {
    if (this.config.publicUrlPrefix) {
      return `${this.config.publicUrlPrefix}/${relativePath.replace(/\\/g, '/')}`
    }
    // Default: serve through local API
    return `/api/files/${relativePath.replace(/\\/g, '/')}`
  }

  /**
   * Build path for audio files
   */
  private buildAudioPath(workspaceId: string, filename: string): string {
    return path.join('generated', workspaceId, 'voice', filename)
  }

  /**
   * Build path for generic files
   */
  private buildFilePath(workspaceId: string, fileId: string, filename: string): string {
    // Store in date-based directories for better organization
    const now = new Date()
    const datePath = path.join(
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    )
    return path.join('uploads', workspaceId, datePath, `${fileId}_${filename}`)
  }
}

// Default instance for server-side usage (local storage)
export const storageService = new StorageService({
  type: 'LOCAL',
  basePath: process.cwd(),
  publicUrlPrefix: undefined, // Will use /api/files/ prefix
})

// Factory for creating instances with custom config
export function createStorageService(config: StorageConfig): StorageService {
  return new StorageService(config)
}
