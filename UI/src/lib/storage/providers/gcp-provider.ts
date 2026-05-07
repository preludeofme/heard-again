import { logger } from '@/lib/logger'
import { StorageProvider } from './index'
import { Storage, StorageOptions } from '@google-cloud/storage'
import { v4 as uuidv4 } from 'uuid'

export interface GCSStorageConfig {
  bucketName: string
  keyFilename?: string
  projectId?: string
}

export class GCSStorageProvider implements StorageProvider {
  private storage: Storage
  private bucketName: string
  private readonly isEmulator: boolean

  constructor(config: GCSStorageConfig) {
    this.bucketName = config.bucketName
    this.isEmulator = Boolean(process.env.STORAGE_EMULATOR_HOST)

    const storageOptions: StorageOptions = {}

    if (config.keyFilename) {
      storageOptions.keyFilename = config.keyFilename
    }
    if (config.projectId) {
      storageOptions.projectId = config.projectId
    }

    if (this.isEmulator) {
      const emulatorHost = process.env.STORAGE_EMULATOR_HOST as string
      // Ensure the host has an http:// scheme for fake-gcs-server
      storageOptions.apiEndpoint = emulatorHost.startsWith('http')
        ? emulatorHost
        : `http://${emulatorHost}`
    }

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

    await fileObject.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: options?.metadata ?? {},
      },
    })

    return {
      id,
      filename,
      storagePath,
      publicUrl: '', // No public URLs — use signed URLs instead
      sizeBytes,
    }
  }

  async deleteFile(storagePath: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName)
      const fileObject = bucket.file(storagePath)
      await fileObject.delete()
    } catch (error) {
      logger.error('Failed to delete GCS file:', error)
      throw error
    }
  }

  async getPublicUrl(_storagePath: string): Promise<string> {
    throw new Error('Public URLs not supported. Use getSignedUrl instead.')
  }

  async getSignedUrl(storagePath: string, expiresIn: number = 15 * 60): Promise<string> {
    // Emulator does not support signing — return direct URL for local dev only
    if (this.isEmulator) {
      const emulatorHost = process.env.STORAGE_EMULATOR_HOST as string
      const base = emulatorHost.startsWith('http') ? emulatorHost : `http://${emulatorHost}`
      return `${base}/${this.bucketName}/${storagePath}`
    }

    try {
      const bucket = this.storage.bucket(this.bucketName)
      const fileObject = bucket.file(storagePath)

      const [signedUrl] = await fileObject.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresIn * 1000,
      })

      return signedUrl
    } catch (error) {
      logger.error('Failed to generate GCS signed URL:', error)
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
      logger.error('Failed to read GCS file:', error)
      throw error
    }
  }

  /** Only runs when STORAGE_EMULATOR_HOST is set. No-op in production. */
  async ensureBucketExists(): Promise<void> {
    if (!this.isEmulator) return

    try {
      const bucket = this.storage.bucket(this.bucketName)
      const [exists] = await bucket.exists()
      if (!exists) {
        await bucket.create()
        logger.info(`Created GCS bucket: ${this.bucketName}`)
      }
    } catch (error) {
      logger.error('Failed to ensure GCS bucket exists:', error)
      throw error
    }
  }

  async setCorsConfiguration(): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName)

      const corsConfiguration = [
        {
          maxAgeSeconds: 3600,
          method: ['GET', 'HEAD'],
          origin: [],
          responseHeader: ['Content-Type'],
        },
      ]

      await bucket.setCorsConfiguration(corsConfiguration)
      logger.info('CORS configuration set for bucket:', this.bucketName)
    } catch (error) {
      logger.error('Failed to set CORS configuration:', error)
      // Non-critical — do not rethrow
    }
  }
}

/** @deprecated Use GCSStorageProvider */
export { GCSStorageProvider as GCPStorageProvider }

/** @deprecated Use GCSStorageConfig */
export type { GCSStorageConfig as GCPStorageConfig }
