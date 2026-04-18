import { logger } from '@/lib/logger'
import { StorageProvider } from './index'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

export interface LocalStorageConfig {
  uploadDir: string
  baseUrl: string
}

export class LocalStorageProvider implements StorageProvider {
  private config: LocalStorageConfig
  private initialized = false
  private initializationPromise: Promise<void> | null = null

  constructor(config: LocalStorageConfig) {
    this.config = config
    // Don't perform async operations in constructor
  }

  /**
   * Initialize the provider - call this before using or use the static factory method
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return
    
    if (this.initializationPromise) {
      return this.initializationPromise
    }
    
    this.initializationPromise = this.ensureUploadDir()
    await this.initializationPromise
  }

  /**
   * Static factory method that returns an initialized provider
   */
  static async create(config: LocalStorageConfig): Promise<LocalStorageProvider> {
    const provider = new LocalStorageProvider(config)
    await provider.initialize()
    return provider
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.access(this.config.uploadDir)
    } catch {
      await fs.mkdir(this.config.uploadDir, { recursive: true })
    }
    this.initialized = true
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  private sanitizePath(storagePath: string): string {
    // Normalize path and remove traversal attempts
    const normalized = path.normalize(storagePath)
      .replace(/^(\.\.(\/|\\|$))+/, '')
      .replace(/^[\/\\]/, '')  // Remove leading slashes
    
    const fullPath = path.join(this.config.uploadDir, normalized)
    
    // Ensure path stays within upload directory
    const resolvedPath = path.resolve(fullPath)
    const resolvedUploadDir = path.resolve(this.config.uploadDir)
    
    if (!resolvedPath.startsWith(resolvedUploadDir)) {
      throw new Error('Path traversal detected: path escapes upload directory')
    }
    
    return fullPath
  }

  /**
   * Generate a safe filename with correct extension based on MIME type
   */
  private generateFilename(originalName: string, mimeType: string): string {
    const id = uuidv4()
    
    // Map MIME types to secure extensions
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/mp4': 'm4a',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'text/csv': 'csv',
      'application/json': 'json',
    }

    const extension = mimeToExt[mimeType] || 'bin'
    return `${id}.${extension}`
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
    await this.ensureInitialized()
    const id = uuidv4()
    
    // Generate secure filename with correct extension based on MIME type
    const secureFilename = this.generateFilename(filename, mimeType)
    
    // Create folder if specified
    if (options?.folder) {
      const folderPath = this.sanitizePath(options.folder)
      await fs.mkdir(folderPath, { recursive: true })
    }

    // Build full path with folder if specified
    const fullPath = options?.folder 
      ? this.sanitizePath(path.join(options.folder, secureFilename))
      : this.sanitizePath(secureFilename)
    
    let buffer: Buffer
    let sizeBytes: number
    
    if (file instanceof File) {
      buffer = Buffer.from(await file.arrayBuffer())
      sizeBytes = file.size
    } else {
      buffer = file
      sizeBytes = buffer.length
    }

    await fs.writeFile(fullPath, buffer)
    
    // Build storage path relative to upload directory
    const storagePath = options?.folder 
      ? path.join(options.folder, secureFilename)
      : secureFilename
    
    const publicUrl = `${this.config.baseUrl}/${storagePath}`

    return {
      id,
      filename: secureFilename, // Return the secure filename, not original
      storagePath,
      publicUrl,
      sizeBytes,
    }
  }

  async deleteFile(storagePath: string): Promise<void> {
    const fullPath = this.sanitizePath(storagePath)
    try {
      await fs.unlink(fullPath)
    } catch (error) {
      logger.error('Failed to delete local file:', error)
      throw error
    }
  }

  async getPublicUrl(storagePath: string): Promise<string> {
    return `${this.config.baseUrl}/${storagePath}`
  }

  async getFile(storagePath: string): Promise<Buffer> {
    const fullPath = this.sanitizePath(storagePath)
    try {
      return await fs.readFile(fullPath)
    } catch (error) {
      logger.error('Failed to read local file:', error)
      throw error
    }
  }
}
