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

  constructor(config: LocalStorageConfig) {
    this.config = config
    this.ensureUploadDir()
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.access(this.config.uploadDir)
    } catch {
      await fs.mkdir(this.config.uploadDir, { recursive: true })
    }
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
    const storagePath = filename
    
    // Create folder if specified
    if (options?.folder) {
      const folderPath = path.join(this.config.uploadDir, options.folder)
      await fs.mkdir(folderPath, { recursive: true })
    }

    const fullPath = path.join(this.config.uploadDir, storagePath)
    
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
    
    const publicUrl = `${this.config.baseUrl}/${storagePath}`

    return {
      id,
      filename,
      storagePath,
      publicUrl,
      sizeBytes,
    }
  }

  async deleteFile(storagePath: string): Promise<void> {
    const fullPath = path.join(this.config.uploadDir, storagePath)
    try {
      await fs.unlink(fullPath)
    } catch (error) {
      console.error('Failed to delete local file:', error)
      throw error
    }
  }

  async getPublicUrl(storagePath: string): Promise<string> {
    return `${this.config.baseUrl}/${storagePath}`
  }

  async getFile(storagePath: string): Promise<Buffer> {
    const fullPath = path.join(this.config.uploadDir, storagePath)
    try {
      return await fs.readFile(fullPath)
    } catch (error) {
      console.error('Failed to read local file:', error)
      throw error
    }
  }
}
